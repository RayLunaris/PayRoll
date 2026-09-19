import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, payrolls, employees, eq, and, desc, inArray } from '@payrollpro/db';
import { processAllPayrolls, processEmployeePayroll } from '../services/payroll-processor.js';
import { generatePayslip } from '../services/payslip.js';
import type { PayrollResult } from '../services/payroll-processor.js';

const processSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
});

// Resolve a manager's department-scoping decision for a given employeeId.
// Managers must never read, process, or mark paid payrolls outside their
// own department (RBAC was enforced on the LIST only; the detail/slip/paid
// and single-employee process endpoints were wide open).
async function resolveManagerScope(userId: string, employeeId: string | null): Promise<'ok' | 'no-dept' | 'forbidden'> {
  if (!employeeId) {
    return 'forbidden';
  }
  const mgrEmp = await db.select().from(employees).where(eq(employees.userId, userId)).limit(1);
  if (mgrEmp.length === 0 || !mgrEmp[0].departmentId) {
    return 'no-dept';
  }
  const targetEmp = await db.select({ departmentId: employees.departmentId })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  if (targetEmp.length === 0 || targetEmp[0].departmentId !== mgrEmp[0].departmentId) {
    return 'forbidden';
  }
  return 'ok';
}

export async function payrollRoutes(app: FastifyInstance) {
  // Process payroll for all employees
  app.post('/process', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const body = processSchema.parse(request.body);

      let results: PayrollResult[];
      if (user.role === 'manager') {
        // A manager may only process payroll for employees of their own department.
        const mgrEmp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (mgrEmp.length === 0 || !mgrEmp[0].departmentId) {
          return reply.status(404).send({ success: false, error: 'Manager employee record or department not found' });
        }
        const deptEmps = await db.select({ id: employees.id }).from(employees)
          .where(eq(employees.departmentId, mgrEmp[0].departmentId));
        results = await processAllPayrolls(body.month, body.year, deptEmps.map((e) => e.id));
      } else {
        results = await processAllPayrolls(body.month, body.year);
      }

      return reply.status(201).send({
        success: true,
        data: results,
        message: `Processed ${results.length} payrolls for ${body.month}/${body.year}`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      if (error?.message?.includes('already been marked as paid')) {
        return reply.status(400).send({ success: false, error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Process payroll for single employee
  app.post('/process/employee', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const body = processSchema.extend({ employeeId: z.string().uuid() }).parse(request.body);

      if (user.role === 'manager') {
        const scope = await resolveManagerScope(user.id, body.employeeId);
        if (scope === 'no-dept') {
          return reply.status(404).send({ success: false, error: 'Manager employee record or department not found' });
        }
        if (scope === 'forbidden') {
          return reply.status(403).send({ success: false, error: 'Forbidden: Can only process payroll for employees from your own department' });
        }
      }

      const result = await processEmployeePayroll(body.employeeId, body.month, body.year);

      return reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      if (error?.message?.includes('already been marked as paid')) {
        return reply.status(400).send({ success: false, error: error.message });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get all payrolls
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { month, year, employeeId } = request.query as {
        month?: string | number;
        year?: string | number;
        employeeId?: string;
      };

      let targetEmployeeId = employeeId;
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.send({ success: true, data: [] });
        }
        targetEmployeeId = emp[0].id;
      }

      const conditions = [];
      if (month) conditions.push(eq(payrolls.periodMonth, parseInt(month.toString(), 10)));
      if (year) conditions.push(eq(payrolls.periodYear, parseInt(year.toString(), 10)));
      if (targetEmployeeId) conditions.push(eq(payrolls.employeeId, targetEmployeeId));

      // Managers only see payrolls from their own department.
      if (user.role === 'manager') {
        const mgrEmp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (mgrEmp.length === 0 || !mgrEmp[0].departmentId) {
          return reply.status(404).send({ success: false, error: 'Manager employee record or department not found' });
        }
        const deptEmps = await db.select({ id: employees.id }).from(employees)
          .where(eq(employees.departmentId, mgrEmp[0].departmentId));
        conditions.push(inArray(payrolls.employeeId, deptEmps.map((e) => e.id)));
      }

      let data;
      if (conditions.length > 0) {
        data = await db.select().from(payrolls).where(and(...conditions)).orderBy(desc(payrolls.createdAt));
      } else {
        data = await db.select().from(payrolls).orderBy(desc(payrolls.createdAt));
      }

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get single payroll (IDOR protected)
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };
      const payroll = await db.select().from(payrolls).where(eq(payrolls.id, id)).limit(1);

      if (payroll.length === 0) {
        return reply.status(404).send({ success: false, error: 'Payroll not found' });
      }

      // Check ownership for regular employee
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0 || payroll[0].employeeId !== emp[0].id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
        }
      }

      // Managers may only read payrolls in their own department.
      if (user.role === 'manager') {
        const scope = await resolveManagerScope(user.id, payroll[0].employeeId);
        if (scope === 'no-dept') {
          return reply.status(404).send({ success: false, error: 'Manager employee record or department not found' });
        }
        if (scope === 'forbidden') {
          return reply.status(403).send({ success: false, error: 'Forbidden: Can only access payrolls from your own department' });
        }
      }

      return reply.send({ success: true, data: payroll[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Download payslip PDF (IDOR protected)
  app.get('/:id/slip', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };
      const payroll = await db.select().from(payrolls).where(eq(payrolls.id, id)).limit(1);

      if (payroll.length === 0) {
        return reply.status(404).send({ success: false, error: 'Payroll not found' });
      }

      // Check ownership for regular employee
      if (user.role === 'employee') {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0 || payroll[0].employeeId !== emp[0].id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
        }
      }

      // Managers may only download payslips from their own department.
      if (user.role === 'manager') {
        const scope = await resolveManagerScope(user.id, payroll[0].employeeId);
        if (scope === 'no-dept') {
          return reply.status(404).send({ success: false, error: 'Manager employee record or department not found' });
        }
        if (scope === 'forbidden') {
          return reply.status(403).send({ success: false, error: 'Forbidden: Can only download payslips from your own department' });
        }
      }

      const pdfBuffer = await generatePayslip(id);

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="payslip-${id}.pdf"`)
        .send(pdfBuffer);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Failed to generate payslip' });
    }
  });

  // Mark payroll as paid
  app.put('/:id/paid', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['manager', 'hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const { id } = request.params as { id: string };

      // Manager must verify the target payroll belongs to their department
      // before marking it paid, otherwise they can mark ANY payroll paid by id.
      if (user.role === 'manager') {
        const payroll = await db.select({ employeeId: payrolls.employeeId }).from(payrolls).where(eq(payrolls.id, id)).limit(1);
        if (payroll.length === 0) {
          return reply.status(404).send({ success: false, error: 'Payroll not found' });
        }
        const scope = await resolveManagerScope(user.id, payroll[0].employeeId);
        if (scope === 'no-dept') {
          return reply.status(404).send({ success: false, error: 'Manager employee record or department not found' });
        }
        if (scope === 'forbidden') {
          return reply.status(403).send({ success: false, error: 'Forbidden: Can only mark paid payrolls from your own department' });
        }
      }

      const updated = await db.update(payrolls)
        .set({
          status: 'paid',
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payrolls.id, id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({ success: false, error: 'Payroll not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
