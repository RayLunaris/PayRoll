import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, shifts, employeeShifts, shiftSwaps, employees, eq, and, or, desc, asc, gte, lte, sql } from '@payrollpro/db';
import { getWIBDateString, getWIBTimeString, timeToMinutes } from '@payrollpro/shared-types';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const shiftSchema = z.object({
  name: z.string().min(1, 'Shift name is required'),
  startTime: z.string().regex(timeRegex, 'Start time must be HH:MM or HH:MM:SS'),
  endTime: z.string().regex(timeRegex, 'End time must be HH:MM or HH:MM:SS'),
});

const assignSchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
  date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
});

const swapSchema = z.object({
  targetEmployeeId: z.string().uuid(),
  date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  employeeId: z.string().uuid().optional(),
});

const approveSwapSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

const calendarQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  month: z.coerce.number().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12').optional().default(new Date().getMonth() + 1),
  year: z.coerce.number().min(2000).max(2100).optional().default(new Date().getFullYear()),
});

const MIN_REST_HOURS = 11;

async function checkRestPeriodViolation(employeeId: string, date: string, shiftId: string): Promise<string | null> {
  const shift = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
  if (shift.length === 0) return null;
  const newStart = timeToMinutes(shift[0].startTime);
  const newEnd = timeToMinutes(shift[0].endTime);

  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().slice(0, 10);

  const prevShift = await db.select({ shiftId: employeeShifts.shiftId })
    .from(employeeShifts)
    .where(and(eq(employeeShifts.employeeId, employeeId), eq(employeeShifts.date, prevDateStr)))
    .limit(1);

  if (prevShift.length > 0) {
    const prevShiftData = await db.select().from(shifts).where(eq(shifts.id, prevShift[0].shiftId!)).limit(1);
    if (prevShiftData.length > 0) {
      const prevEnd = timeToMinutes(prevShiftData[0].endTime);
      const prevStart = timeToMinutes(prevShiftData[0].startTime);
      let gap: number;
      if (prevEnd <= prevStart) {
        // Overnight previous shift: finished in the early morning of today
        gap = newStart - prevEnd;
      } else {
        // Same-day previous shift: finished yesterday, rest covers the overnight span
        gap = (24 * 60 - prevEnd) + newStart;
      }
      if (gap < MIN_REST_HOURS * 60) {
        return `Rest period violation: only ${Math.round(gap / 60)}h gap from previous shift (minimum ${MIN_REST_HOURS}h required)`;
      }
    }
  }

  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().slice(0, 10);

  const nextShift = await db.select({ shiftId: employeeShifts.shiftId })
    .from(employeeShifts)
    .where(and(eq(employeeShifts.employeeId, employeeId), eq(employeeShifts.date, nextDateStr)))
    .limit(1);

  if (nextShift.length > 0) {
    const nextShiftData = await db.select().from(shifts).where(eq(shifts.id, nextShift[0].shiftId!)).limit(1);
    if (nextShiftData.length > 0) {
      const nextStart = timeToMinutes(nextShiftData[0].startTime);
      let gap: number;
      if (newEnd < nextStart) {
        gap = nextStart - newEnd;
      } else {
        gap = (24 * 60 - newEnd) + nextStart;
      }
      if (gap < MIN_REST_HOURS * 60) {
        return `Rest period violation: only ${Math.round(gap / 60)}h gap to next shift (minimum ${MIN_REST_HOURS}h required)`;
      }
    }
  }

  return null;
}

export async function shiftRoutes(app: FastifyInstance) {
  // Get all master shifts
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(shifts).orderBy(asc(shifts.startTime));
      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get single shift by ID
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const shift = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);

      if (shift.length === 0) {
        return reply.status(404).send({ success: false, error: 'Shift not found' });
      }

      return reply.send({ success: true, data: shift[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Create master shift (Manager / HR Admin / Super Admin)
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const body = shiftSchema.parse(request.body);
      const newShift = await db.insert(shifts).values({
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
      }).returning();

      return reply.status(201).send({ success: true, data: newShift[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Update master shift (Manager / HR Admin / Super Admin)
  app.put('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const { id } = request.params as { id: string };
      const body = shiftSchema.partial().parse(request.body);

      const updated = await db.update(shifts)
        .set(body)
        .where(eq(shifts.id, id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({ success: false, error: 'Shift not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Delete master shift (Manager / HR Admin / Super Admin)
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const { id } = request.params as { id: string };
      const deleted = await db.delete(shifts).where(eq(shifts.id, id)).returning();

      if (deleted.length === 0) {
        return reply.status(404).send({ success: false, error: 'Shift not found' });
      }

      return reply.send({ success: true, message: 'Shift deleted successfully' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Assign shift to employee (Manager / HR Admin / Super Admin)
  app.post('/assign', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const body = assignSchema.parse(request.body);

      // Verify employee exists
      const emp = await db.select().from(employees).where(eq(employees.id, body.employeeId)).limit(1);
      if (emp.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      // Verify shift exists
      const shift = await db.select().from(shifts).where(eq(shifts.id, body.shiftId)).limit(1);
      if (shift.length === 0) {
        return reply.status(404).send({ success: false, error: 'Shift not found' });
      }

      // Check rest period before assigning
      const restViolation = await checkRestPeriodViolation(body.employeeId, body.date, body.shiftId);
      if (restViolation) {
        return reply.status(400).send({ success: false, error: restViolation });
      }

      // Check if already assigned on that date
      const existing = await db.select().from(employeeShifts)
        .where(and(
          eq(employeeShifts.employeeId, body.employeeId),
          eq(employeeShifts.date, body.date)
        ))
        .limit(1);

      let result;
      if (existing.length > 0) {
        const updated = await db.update(employeeShifts)
          .set({ shiftId: body.shiftId })
          .where(eq(employeeShifts.id, existing[0].id))
          .returning();
        result = updated[0];
      } else {
        const created = await db.insert(employeeShifts).values({
          employeeId: body.employeeId,
          shiftId: body.shiftId,
          date: body.date,
        }).returning();
        result = created[0];
      }

      return reply.status(201).send({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get shift calendar for a period (Strict month validation)
  app.get('/calendar', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const query = calendarQuerySchema.parse(request.query);

      let targetEmployeeId = query.employeeId;
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.send({ success: true, data: [] });
        }
        targetEmployeeId = emp[0].id;
      }

      const m = query.month;
      const y = query.year;
      const startDate = `${y}-${m.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      const conditions = [
        gte(employeeShifts.date, startDate),
        lte(employeeShifts.date, endDate),
      ];

      if (targetEmployeeId) {
        conditions.push(eq(employeeShifts.employeeId, targetEmployeeId));
      }

      const data = await db.select({
        id: employeeShifts.id,
        employeeId: employeeShifts.employeeId,
        shiftId: employeeShifts.shiftId,
        date: employeeShifts.date,
        shiftName: shifts.name,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
      })
      .from(employeeShifts)
      .innerJoin(shifts, eq(employeeShifts.shiftId, shifts.id))
      .where(and(...conditions))
      .orderBy(asc(employeeShifts.date));

      return reply.send({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Request shift swap (Creates pending request, executed only after target employee approval)
  app.post('/swap', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = swapSchema.parse(request.body);

      // Ownership enforcement: Employee can only swap their own shift
      let employeeAId: string;
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.status(404).send({ success: false, error: 'Requesting employee not found' });
        }
        employeeAId = emp[0].id;
      } else {
        if (body.employeeId) {
          employeeAId = body.employeeId;
        } else {
          const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
          if (emp.length === 0) {
            return reply.status(404).send({ success: false, error: 'Requesting employee not found' });
          }
          employeeAId = emp[0].id;
        }
      }

      const employeeBId = body.targetEmployeeId;

      if (employeeAId === employeeBId) {
        return reply.status(400).send({ success: false, error: 'Cannot swap shift with yourself' });
      }

      const targetEmp = await db.select().from(employees).where(eq(employees.id, employeeBId)).limit(1);
      if (targetEmp.length === 0) {
        return reply.status(404).send({ success: false, error: 'Target employee not found' });
      }

      // Check for existing pending swap between these employees on the same date
      const pendingSwap = await db.select().from(shiftSwaps)
        .where(and(
          eq(shiftSwaps.date, body.date),
          eq(shiftSwaps.status, 'pending'),
          or(
            and(eq(shiftSwaps.requesterId, employeeAId), eq(shiftSwaps.targetId, employeeBId)),
            and(eq(shiftSwaps.requesterId, employeeBId), eq(shiftSwaps.targetId, employeeAId))
          )
        ))
        .limit(1);

      if (pendingSwap.length > 0) {
        return reply.status(400).send({ success: false, error: 'A pending swap request already exists on this date' });
      }

      // Find shift assignment for Employee A on date
      const shiftA = await db.select().from(employeeShifts)
        .where(and(
          eq(employeeShifts.employeeId, employeeAId),
          eq(employeeShifts.date, body.date)
        ))
        .limit(1);

      // Find shift assignment for Employee B on date
      const shiftB = await db.select().from(employeeShifts)
        .where(and(
          eq(employeeShifts.employeeId, employeeBId),
          eq(employeeShifts.date, body.date)
        ))
        .limit(1);

      if (shiftA.length === 0) {
        return reply.status(400).send({
          success: false,
          error: `Requesting employee has no shift assigned on ${body.date}`,
        });
      }

      if (shiftB.length === 0) {
        return reply.status(400).send({
          success: false,
          error: `Target employee has no shift assigned on ${body.date}`,
        });
      }

      const created = await db.insert(shiftSwaps).values({
        requesterId: employeeAId,
        targetId: employeeBId,
        date: body.date,
        status: 'pending',
      }).returning();

      return reply.status(201).send({
        success: true,
        message: 'Shift swap requested. Awaiting target employee approval.',
        data: created[0],
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get shift swap requests (Ownership protected)
  app.get('/swap/requests', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { status, direction } = request.query as { status?: string; direction?: string };

      const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      if (emp.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      const conditions = [];
      if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        conditions.push(eq(shiftSwaps.status, status));
      }
      // Employee sees swaps; direction=incoming -> requests targeting them, outgoing -> theirs
      if (direction === 'incoming') {
        conditions.push(eq(shiftSwaps.targetId, emp[0].id));
      } else if (direction === 'outgoing') {
        conditions.push(eq(shiftSwaps.requesterId, emp[0].id));
      } else {
        conditions.push(sql`(${shiftSwaps.requesterId} = ${emp[0].id} OR ${shiftSwaps.targetId} = ${emp[0].id})`);
      }

      const data = await db.select().from(shiftSwaps)
        .where(and(...conditions))
        .orderBy(desc(shiftSwaps.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Approve / Reject shift swap (Target employee approval. Manager/HR can override)
  app.put('/swap/:id/approve', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };
      const body = approveSwapSchema.parse(request.body);

      const swap = await db.select().from(shiftSwaps).where(eq(shiftSwaps.id, id)).limit(1);
      if (swap.length === 0) {
        return reply.status(404).send({ success: false, error: 'Swap request not found' });
      }

      const targetSwap = swap[0];
      if (targetSwap.status !== 'pending') {
        return reply.status(400).send({ success: false, error: 'Swap request already processed' });
      }

      // Permit only: target employee or manager/hr_admin/super_admin
      let isTargetEmployee = false;
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.status(404).send({ success: false, error: 'Employee not found' });
        }
        isTargetEmployee = targetSwap.targetId === emp[0].id;
        if (!isTargetEmployee) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Only the target employee can approve this swap' });
        }
      } else if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      if (!body.approved) {
        const rejected = await db.update(shiftSwaps)
          .set({ status: 'rejected', decidedBy: user.id, decidedAt: new Date() })
          .where(eq(shiftSwaps.id, id))
          .returning();

        return reply.send({ success: true, message: 'Shift swap request rejected', data: rejected[0] });
      }

      let updatedA: any;
      let updatedB: any;
      let finalSwap: any;

      await db.transaction(async (tx) => {
        const requesterId = targetSwap.requesterId!;
        const targetId = targetSwap.targetId!;

        // Find both assignments on that date
        const shiftA = await tx.select().from(employeeShifts)
          .where(and(
            eq(employeeShifts.employeeId, requesterId),
            eq(employeeShifts.date, targetSwap.date)
          ))
          .limit(1);

        const shiftB = await tx.select().from(employeeShifts)
          .where(and(
            eq(employeeShifts.employeeId, targetId),
            eq(employeeShifts.date, targetSwap.date)
          ))
          .limit(1);

        if (shiftA.length === 0 || shiftB.length === 0) {
          throw new Error('One or both employees no longer have a shift assigned on the swap date');
        }

        // Rest-period check after swap
        const newShiftForA = shiftB[0].shiftId!;
        const newShiftForB = shiftA[0].shiftId!;
        const violationA = await checkRestPeriodViolation(requesterId, targetSwap.date, newShiftForA);
        const violationB = await checkRestPeriodViolation(targetId, targetSwap.date, newShiftForB);
        if (violationA) throw new Error(`Rest period violation for requester: ${violationA}`);
        if (violationB) throw new Error(`Rest period violation for target: ${violationB}`);

        const resA = await tx.update(employeeShifts)
          .set({ shiftId: newShiftForA })
          .where(eq(employeeShifts.id, shiftA[0].id))
          .returning();

        const resB = await tx.update(employeeShifts)
          .set({ shiftId: newShiftForB })
          .where(eq(employeeShifts.id, shiftB[0].id))
          .returning();

        const swapUpdate = await tx.update(shiftSwaps)
          .set({ status: 'approved', decidedBy: user.id, decidedAt: new Date() })
          .where(eq(shiftSwaps.id, id))
          .returning();

        updatedA = resA[0];
        updatedB = resB[0];
        finalSwap = swapUpdate[0];
      });

      return reply.send({
        success: true,
        message: 'Shift swap approved and applied',
        data: { request: finalSwap, employeeA: updatedA, employeeB: updatedB },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      if (error?.message?.includes('Rest period violation') || error?.message?.includes('no longer have a shift')) {
        return reply.status(400).send({ success: false, error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get employee's current shift (WIB Timezone & Overnight Shift Handling)
  app.get('/current', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const today = getWIBDateString();
      const currentWibTime = getWIBTimeString();
      const currentMinutes = timeToMinutes(currentWibTime);

      const employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      if (employee.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      // 1. Check today's shift
      const todayShift = await db.select({
        id: employeeShifts.id,
        employeeId: employeeShifts.employeeId,
        shiftId: employeeShifts.shiftId,
        date: employeeShifts.date,
        shiftName: shifts.name,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
      })
      .from(employeeShifts)
      .innerJoin(shifts, eq(employeeShifts.shiftId, shifts.id))
      .where(and(
        eq(employeeShifts.employeeId, employee[0].id),
        eq(employeeShifts.date, today)
      ))
      .limit(1);

      if (todayShift.length > 0) {
        return reply.send({ success: true, data: todayShift[0] });
      }

      // 2. Check if yesterday had an overnight shift (cross-midnight, e.g. 20:00 - 04:00)
      const yesterday = getWIBDateString(new Date(Date.now() - 24 * 3600000));
      const yesterdayShift = await db.select({
        id: employeeShifts.id,
        employeeId: employeeShifts.employeeId,
        shiftId: employeeShifts.shiftId,
        date: employeeShifts.date,
        shiftName: shifts.name,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
      })
      .from(employeeShifts)
      .innerJoin(shifts, eq(employeeShifts.shiftId, shifts.id))
      .where(and(
        eq(employeeShifts.employeeId, employee[0].id),
        eq(employeeShifts.date, yesterday)
      ))
      .limit(1);

      if (yesterdayShift.length > 0) {
        const startMin = timeToMinutes(yesterdayShift[0].startTime);
        const endMin = timeToMinutes(yesterdayShift[0].endTime);

        // Overnight shift: ends next day morning (endMin < startMin) and current time is before or equal to shift end
        if (endMin < startMin && currentMinutes <= endMin) {
          return reply.send({ success: true, data: yesterdayShift[0] });
        }
      }

      return reply.send({ success: true, data: null });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
