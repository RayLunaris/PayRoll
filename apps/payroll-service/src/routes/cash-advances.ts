import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, cashAdvances, employees, positions, eq, and, desc, inArray } from '@payrollpro/db';

const cashAdvanceSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().optional(),
  employeeId: z.string().uuid().optional(),
});

const approveSchema = z.object({
  approved: z.boolean(),
});

const ADMIN_ROLES = ['super_admin', 'hr_admin', 'manager'];

// Resolve which employee record a request may target.
// - Employees: only their own record; impersonation is rejected.
// - Admins/HR/Managers: may act on behalf of another employee (body.employeeId).
async function resolveTargetEmployee(
  user: { id: string; role: string },
  requestedEmployeeId: string | undefined,
): Promise<{ employeeId: string; isOwn: boolean } | null> {
  const own = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);

  if (ADMIN_ROLES.includes(user.role)) {
    if (requestedEmployeeId) {
      return { employeeId: requestedEmployeeId, isOwn: own.length > 0 && own[0].id === requestedEmployeeId };
    }
    if (own.length > 0) {
      return { employeeId: own[0].id, isOwn: true };
    }
    return null;
  }

  if (own.length === 0) {
    return null;
  }
  if (requestedEmployeeId && requestedEmployeeId !== own[0].id) {
    return { employeeId: '', isOwn: false };
  }
  return { employeeId: own[0].id, isOwn: true };
}

export async function cashAdvanceRoutes(app: FastifyInstance) {
  // Request cash advance
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = cashAdvanceSchema.parse(request.body);

      const target = await resolveTargetEmployee(user, body.employeeId);
      if (!target) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }
      if (!target.isOwn) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Cannot request cash advance for another employee' });
      }

      const emp = (await db.select().from(employees).where(eq(employees.id, target.employeeId)).limit(1))[0];
      let baseSalary = parseFloat(emp.baseSalary || '0');
      if (baseSalary <= 0 && emp.positionId) {
        const pos = await db.select().from(positions).where(eq(positions.id, emp.positionId)).limit(1);
        if (pos.length > 0 && pos[0].baseSalary) {
          baseSalary = parseFloat(pos[0].baseSalary);
        }
      }

      // Check cash advance limit (maximum 25% of base salary)
      const maxAdvance = baseSalary * 0.25;
      if (body.amount > maxAdvance) {
        return reply.status(400).send({
          success: false,
          error: `Cash advance cannot exceed 25% of salary (max: Rp ${maxAdvance.toLocaleString('id-ID')})`,
        });
      }

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Check existing pending request in current month
      const existingPending = await db.select().from(cashAdvances)
        .where(and(
          eq(cashAdvances.employeeId, emp.id),
          eq(cashAdvances.month, currentMonth),
          eq(cashAdvances.year, currentYear),
          eq(cashAdvances.status, 'pending')
        ));

      if (existingPending.length > 0) {
        return reply.status(400).send({
          success: false,
          error: 'Already have a pending cash advance request this month',
        });
      }

      // Cumulative limit: total approved/deducted advances this month + this request <= 25%
      const existingApproved = await db.select().from(cashAdvances)
        .where(and(
          eq(cashAdvances.employeeId, emp.id),
          eq(cashAdvances.month, currentMonth),
          eq(cashAdvances.year, currentYear),
          inArray(cashAdvances.status, ['approved', 'deducted'])
        ));

      const alreadyApproved = existingApproved.reduce((sum, a) => sum + parseFloat(a.amount || '0'), 0);
      if (alreadyApproved + body.amount > maxAdvance) {
        return reply.status(400).send({
          success: false,
          error: `Cash advance exceeds 25% monthly limit. Already approved: Rp ${alreadyApproved.toLocaleString('id-ID')}, available: Rp ${(maxAdvance - alreadyApproved).toLocaleString('id-ID')}`,
        });
      }

      const newAdvance = await db.insert(cashAdvances).values({
        employeeId: emp.id,
        amount: body.amount.toFixed(2),
        reason: body.reason,
        month: currentMonth,
        year: currentYear,
        status: 'pending',
      }).returning();

      return reply.status(201).send({ success: true, data: newAdvance[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get employee cash advance history (own record only, unless HR/Manager)
  app.get('/history', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { employeeId } = request.query as { employeeId?: string };

      if (user.role === 'employee' && employeeId) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Karyawan tidak diizinkan menggunakan parameter employeeId' });
      }

      const target = await resolveTargetEmployee(user, employeeId);
      if (!target) {
        return reply.send({ success: true, data: [] });
      }
      if (!target.isOwn) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const data = await db.select().from(cashAdvances)
        .where(eq(cashAdvances.employeeId, target.employeeId))
        .orderBy(desc(cashAdvances.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get all cash advances (HR / Admin / Manager)
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!ADMIN_ROLES.includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      if (user.role === 'manager') {
        const mgrEmp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (mgrEmp.length === 0 || !mgrEmp[0].departmentId) {
          return reply.status(404).send({ success: false, error: 'Manager employee record or department not found' });
        }
        const deptEmps = await db.select({ id: employees.id }).from(employees)
          .where(eq(employees.departmentId, mgrEmp[0].departmentId));
        if (deptEmps.length === 0) {
          return reply.send({ success: true, data: [] });
        }
        const data = await db.select().from(cashAdvances)
          .where(inArray(cashAdvances.employeeId, deptEmps.map((e) => e.id)))
          .orderBy(desc(cashAdvances.createdAt));
        return reply.send({ success: true, data });
      }

      const data = await db.select().from(cashAdvances).orderBy(desc(cashAdvances.createdAt));
      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Approve or reject cash advance (HR / Manager)
  app.put('/:id/approve', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!ADMIN_ROLES.includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const { id } = request.params as { id: string };
      const body = approveSchema.parse(request.body);

      const existing = await db.select().from(cashAdvances).where(eq(cashAdvances.id, id)).limit(1);
      if (existing.length === 0) {
        return reply.status(404).send({ success: false, error: 'Cash advance not found' });
      }

      if (existing[0].status !== 'pending') {
        return reply.status(400).send({ success: false, error: 'Cash advance has already been processed' });
      }

      // Prevent self-approval (approver cannot approve their own cash advance)
      const approverEmp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
      if (approverEmp.length > 0 && existing[0].employeeId === approverEmp[0].id) {
        return reply.status(400).send({ success: false, error: 'Tidak dapat menyetujui pengajuan kasbon milik sendiri' });
      }

      if (user.role === 'manager') {
        if (!existing[0].employeeId) {
          return reply.status(400).send({ success: false, error: 'Cash advance has no associated employee' });
        }
        const mgrEmp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (mgrEmp.length === 0 || !mgrEmp[0].departmentId) {
          return reply.status(404).send({ success: false, error: 'Manager employee record or department not found' });
        }
        const targetEmp = await db.select({ departmentId: employees.departmentId })
          .from(employees)
          .where(eq(employees.id, existing[0].employeeId))
          .limit(1);
        if (targetEmp.length === 0 || !targetEmp[0].departmentId || !mgrEmp[0].departmentId || targetEmp[0].departmentId !== mgrEmp[0].departmentId) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Can only manage cash advances from your own department' });
        }
      }

      const updated = await db.update(cashAdvances)
        .set({
          status: body.approved ? 'approved' : 'rejected',
          approvedBy: user.id,
          approvedAt: new Date(),
        })
        .where(eq(cashAdvances.id, id))
        .returning();

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
