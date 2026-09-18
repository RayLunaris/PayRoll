import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, leaves, leaveQuotas, employees, eq, and, or, desc, sql, gte, lte, inArray } from '@payrollpro/db';
import { LeaveType } from '@payrollpro/shared-types';

const leaveSchema = z.object({
  leaveType: z.enum(['annual', 'sick', 'maternity', 'paternity', 'special', 'unpaid']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format must be YYYY-MM-DD'),
  reason: z.string().optional(),
  attachmentUrl: z.string().optional(),
  employeeId: z.string().uuid().optional(),
});

const approveSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

// Default leave quotas per year
const DEFAULT_QUOTAS: Record<string, number> = {
  annual: 12,
  sick: 12,
  maternity: 90,
  paternity: 3,
  special: 0,
  unpaid: 0,
};

export async function leaveRoutes(app: FastifyInstance) {
  // Request leave
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = leaveSchema.parse(request.body);

      // Resolve target employee (anti-impersonation)
      const own = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      const canActForOthers = ['super_admin', 'hr_admin'].includes(user.role);

      let targetEmployeeId: string | null = null;
      if (own.length > 0) {
        if (body.employeeId && own[0].id !== body.employeeId && !canActForOthers) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Cannot submit leave for another employee' });
        }
        targetEmployeeId = body.employeeId || own[0].id;
      } else if (canActForOthers && body.employeeId) {
        targetEmployeeId = body.employeeId;
      }

      if (!targetEmployeeId) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      const employee = await db.select().from(employees).where(eq(employees.id, targetEmployeeId)).limit(1);

      if (employee.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      const emp = employee[0];
      const start = new Date(body.startDate);
      const end = new Date(body.endDate);

      if (end < start) {
        return reply.status(400).send({ success: false, error: 'End date must be after or equal to start date' });
      }

      // Check date overlap with existing pending or approved leave for this employee
      const overlapping = await db.select().from(leaves)
        .where(and(
          eq(leaves.employeeId, emp.id),
          or(eq(leaves.status, 'pending'), eq(leaves.status, 'approved')),
          lte(leaves.startDate, body.endDate),
          gte(leaves.endDate, body.startDate)
        ))
        .limit(1);

      if (overlapping.length > 0) {
        return reply.status(400).send({
          success: false,
          error: `Leave request overlaps with existing ${overlapping[0].status} leave from ${overlapping[0].startDate} to ${overlapping[0].endDate}`,
        });
      }

      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const year = start.getFullYear();

      // Check quota (except for special and unpaid)
      if (body.leaveType !== 'special' && body.leaveType !== 'unpaid') {
        const quota = await db.select().from(leaveQuotas)
          .where(and(
            eq(leaveQuotas.employeeId, emp.id),
            eq(leaveQuotas.leaveType, body.leaveType),
            eq(leaveQuotas.year, year)
          ))
          .limit(1);

        if (quota.length === 0) {
          const defaultQuota = DEFAULT_QUOTAS[body.leaveType] || 0;
          if (days > defaultQuota) {
            return reply.status(400).send({
              success: false,
              error: `Insufficient quota. Available: ${defaultQuota} days, requested: ${days} days`,
            });
          }
        } else {
          const used = quota[0].usedQuota || 0;
          const available = quota[0].totalQuota - used;
          if (days > available) {
            return reply.status(400).send({
              success: false,
              error: `Insufficient quota. Available: ${available} days, requested: ${days} days`,
            });
          }
        }
      }

      // Create leave request
      const newLeave = await db.insert(leaves).values({
        employeeId: emp.id,
        leaveType: body.leaveType as LeaveType,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason,
        attachmentUrl: body.attachmentUrl,
        status: 'pending',
      }).returning();

      return reply.status(201).send({ success: true, data: newLeave[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get leave history (IDOR protected)
  app.get('/history', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { employeeId } = request.query as { employeeId?: string };

      let targetEmployeeId: string;
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.status(404).send({ success: false, error: 'Employee not found' });
        }
        targetEmployeeId = emp[0].id;
      } else {
        if (employeeId) {
          targetEmployeeId = employeeId;
        } else {
          const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
          if (emp.length === 0) {
            return reply.status(404).send({ success: false, error: 'Employee not found' });
          }
          targetEmployeeId = emp[0].id;
        }
      }

      const data = await db.select().from(leaves)
        .where(eq(leaves.employeeId, targetEmployeeId))
        .orderBy(desc(leaves.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get leave quota (IDOR protected)
  app.get('/quota', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { year = new Date().getFullYear(), employeeId } = request.query as { year?: string | number; employeeId?: string };
      const y = parseInt(year.toString(), 10);

      let targetEmployeeId: string;
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.send({ success: true, data: [] });
        }
        targetEmployeeId = emp[0].id;
      } else {
        if (employeeId) {
          targetEmployeeId = employeeId;
        } else {
          const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
          if (emp.length === 0) {
            return reply.send({ success: true, data: [] });
          }
          targetEmployeeId = emp[0].id;
        }
      }

      const quotas = await db.select().from(leaveQuotas)
        .where(and(
          eq(leaveQuotas.employeeId, targetEmployeeId),
          eq(leaveQuotas.year, y)
        ));

      // Create default quotas if not exists
      if (quotas.length === 0) {
        const defaultQuotas = [
          { leaveType: 'annual', totalQuota: 12 },
          { leaveType: 'sick', totalQuota: 12 },
          { leaveType: 'maternity', totalQuota: 90 },
          { leaveType: 'paternity', totalQuota: 3 },
        ];

        for (const quota of defaultQuotas) {
          await db.insert(leaveQuotas).values({
            employeeId: targetEmployeeId,
            leaveType: quota.leaveType,
            year: y,
            totalQuota: quota.totalQuota,
            usedQuota: 0,
          });
        }

        const newQuotas = await db.select().from(leaveQuotas)
          .where(and(
            eq(leaveQuotas.employeeId, targetEmployeeId),
            eq(leaveQuotas.year, y)
          ));

        return reply.send({ success: true, data: newQuotas });
      }

      return reply.send({ success: true, data: quotas });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get leave calendar (Fixed range overlap check)
  app.get('/calendar', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { month = new Date().getMonth() + 1, year = new Date().getFullYear() } = request.query as {
        month?: string | number;
        year?: string | number;
      };

      const m = parseInt(month.toString(), 10);
      const y = parseInt(year.toString(), 10);

      const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      // Correct overlap check for calendar month
      const data = await db.select().from(leaves)
        .where(and(
          lte(leaves.startDate, endDate),
          gte(leaves.endDate, startDate),
          eq(leaves.status, 'approved')
        ));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get pending approvals (Manager filtered by department / HR Admin / Super Admin)
  app.get('/approvals', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;

      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.send({ success: true, data: [] });
      }

      let data;

      if (user.role === 'manager') {
        // Managers only see pending leaves from their own department
        const mgrEmp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (mgrEmp.length === 0 || !mgrEmp[0].departmentId) {
          return reply.status(404).send({ success: false, error: 'Manager employee record or department not found' });
        }
        const deptEmps = await db.select({ id: employees.id }).from(employees)
          .where(eq(employees.departmentId, mgrEmp[0].departmentId!));
        const deptEmpIds = deptEmps.map(e => e.id);

        if (deptEmpIds.length === 0) {
          return reply.send({ success: true, data: [] });
        }

        data = await db.select().from(leaves)
          .where(and(
            eq(leaves.status, 'pending'),
            inArray(leaves.employeeId, deptEmpIds)
          ))
          .orderBy(desc(leaves.createdAt));
      } else {
        data = await db.select().from(leaves)
          .where(eq(leaves.status, 'pending'))
          .orderBy(desc(leaves.createdAt));
      }

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get leave detail (IDOR protected)
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };
      const leave = await db.select().from(leaves).where(eq(leaves.id, id)).limit(1);

      if (leave.length === 0) {
        return reply.status(404).send({ success: false, error: 'Leave not found' });
      }

      // If regular employee, verify ownership
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0 || leave[0].employeeId !== emp[0].id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
        }
      }

      return reply.send({ success: true, data: leave[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Approve/Reject leave (Manager / HR Admin / Super Admin)
  app.put('/:id/approve', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };
      const body = approveSchema.parse(request.body);

      // Check role
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const leave = await db.select().from(leaves).where(eq(leaves.id, id)).limit(1);

      if (leave.length === 0) {
        return reply.status(404).send({ success: false, error: 'Leave not found' });
      }

      if (leave[0].status !== 'pending') {
        return reply.status(400).send({ success: false, error: 'Leave already processed' });
      }

      const targetLeave = leave[0];

      // Prevent self-approval (Managers cannot approve their own leave)
      const approverEmp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      if (approverEmp.length > 0 && targetLeave.employeeId === approverEmp[0].id) {
        return reply.status(400).send({ success: false, error: 'Managers cannot approve their own leave request' });
      }

      const newStatus = body.approved ? 'approved' : 'rejected';
      let resultLeave: any;

      // Atomic transaction for quota update and status change
      await db.transaction(async (tx) => {
        if (body.approved && targetLeave.leaveType !== 'special' && targetLeave.leaveType !== 'unpaid') {
          const leaveStart = new Date(targetLeave.startDate);
          const leaveEnd = new Date(targetLeave.endDate);
          const totalDays = Math.ceil((leaveEnd.getTime() - leaveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          if (targetLeave.employeeId) {
            // Cross-year split: calculate days per year
            const yearChunks: { year: number; days: number }[] = [];
            const cursor = new Date(leaveStart);
            while (cursor <= leaveEnd) {
              const year = cursor.getFullYear();
              const endOfYear = new Date(year, 11, 31);
              const chunkEnd = leaveEnd < endOfYear ? leaveEnd : endOfYear;
              const chunkDays = Math.ceil((chunkEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              yearChunks.push({ year, days: chunkDays });
              cursor.setFullYear(cursor.getFullYear() + 1);
              cursor.setMonth(0);
              cursor.setDate(1);
            }

            // Phase 1: validate quota availability BEFORE mutating usedQuota
            const quotaPlans: { year: number; days: number; existingQuotaId?: string; total: number }[] = [];
            let totalUsedAcrossYears = 0;
            let totalAvailableAcrossYears = 0;

            for (const chunk of yearChunks) {
              const quota = await tx.select().from(leaveQuotas)
                .where(and(
                  eq(leaveQuotas.employeeId, targetLeave.employeeId),
                  eq(leaveQuotas.leaveType, targetLeave.leaveType),
                  eq(leaveQuotas.year, chunk.year)
                ))
                .limit(1);

              const currentUsed = quota.length > 0 ? (quota[0].usedQuota || 0) : 0;
              const total = quota.length > 0 ? quota[0].totalQuota : (DEFAULT_QUOTAS[targetLeave.leaveType] || 0);

              totalUsedAcrossYears += currentUsed;
              totalAvailableAcrossYears += total;

              if (currentUsed + chunk.days > total) {
                throw new Error(`Insufficient leave quota for ${chunk.year}. Available: ${total - currentUsed}, requested: ${chunk.days}`);
              }

              quotaPlans.push({
                year: chunk.year,
                days: chunk.days,
                existingQuotaId: quota.length > 0 ? quota[0].id : undefined,
                total,
              });
            }

            if (totalUsedAcrossYears + totalDays > totalAvailableAcrossYears) {
              throw new Error(`Insufficient leave quota across years. Total available: ${totalAvailableAcrossYears}, requested: ${totalDays}`);
            }

            // Phase 2: apply quota updates
            for (const plan of quotaPlans) {
              if (plan.existingQuotaId) {
                await tx.update(leaveQuotas)
                  .set({ usedQuota: sql`${leaveQuotas.usedQuota} + ${plan.days}` })
                  .where(eq(leaveQuotas.id, plan.existingQuotaId));
              } else {
                await tx.insert(leaveQuotas).values({
                  employeeId: targetLeave.employeeId,
                  leaveType: targetLeave.leaveType,
                  year: plan.year,
                  totalQuota: plan.total,
                  usedQuota: plan.days,
                });
              }
            }
          }
        }

        const updated = await tx.update(leaves)
          .set({
            status: newStatus,
            approvedBy: user.id,
            approvedAt: new Date(),
            notes: body.notes,
          })
          .where(eq(leaves.id, id))
          .returning();

        resultLeave = updated[0];
      });

      return reply.send({ success: true, data: resultLeave });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      if (error?.message?.includes('Insufficient leave quota')) {
        return reply.status(400).send({ success: false, error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Cancel leave request (owner only, pending status)
  app.put('/:id/cancel', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };

      const leave = await db.select().from(leaves).where(eq(leaves.id, id)).limit(1);
      if (leave.length === 0) {
        return reply.status(404).send({ success: false, error: 'Leave not found' });
      }

      const targetLeave = leave[0];

      if (targetLeave.status !== 'pending') {
        return reply.status(400).send({ success: false, error: 'Only pending leaves can be cancelled' });
      }

      // Verify ownership (employee) or allow admin/manager to cancel
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0 || targetLeave.employeeId !== emp[0].id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Not your leave request' });
        }
      }

      const updated = await db.update(leaves)
        .set({ status: 'cancelled' })
        .where(eq(leaves.id, id))
        .returning();

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
