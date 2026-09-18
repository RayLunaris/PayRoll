import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, cashAdvances, employees, eq, and, desc } from '@payrollpro/db';

const cashAdvanceSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().optional(),
  employeeId: z.string().uuid().optional(),
});

const approveSchema = z.object({
  approved: z.boolean(),
});

export async function cashAdvanceRoutes(app: FastifyInstance) {
  // Request cash advance
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = cashAdvanceSchema.parse(request.body);

      let employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      if (employee.length === 0 && body.employeeId) {
        employee = await db.select().from(employees).where(eq(employees.id, body.employeeId)).limit(1);
      }

      if (employee.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      const emp = employee[0];
      const baseSalary = parseFloat(emp.baseSalary || '0');

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

  // Get employee cash advance history
  app.get('/history', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { employeeId } = request.query as { employeeId?: string };

      let employee = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
      if (employee.length === 0 && employeeId) {
        employee = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
      }

      if (employee.length === 0) {
        return reply.send({ success: true, data: [] });
      }

      const data = await db.select().from(cashAdvances)
        .where(eq(cashAdvances.employeeId, employee[0].id))
        .orderBy(desc(cashAdvances.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get all cash advances (HR / Admin)
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
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
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
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
