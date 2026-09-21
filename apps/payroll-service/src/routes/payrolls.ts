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
export async function payrollRoutes(app: FastifyInstance) {
  // Process payroll for all employees (Admin/HR only)
  app.post('/process', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const body = processSchema.parse(request.body);
      const results = await processAllPayrolls(body.month, body.year);

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

  // Process payroll for single employee (Admin/HR only)
  app.post('/process/employee', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const body = processSchema.extend({ employeeId: z.string().uuid() }).parse(request.body);
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

  // Get own payslips (personal history for all roles)
  app.get('/my', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { month, year } = request.query as {
        month?: string | number;
        year?: string | number;
      };

      const emp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
      if (emp.length === 0) {
        return reply.send({ success: true, data: [] });
      }

      const conditions = [eq(payrolls.employeeId, emp[0].id)];
      if (month) conditions.push(eq(payrolls.periodMonth, parseInt(month.toString(), 10)));
      if (year) conditions.push(eq(payrolls.periodYear, parseInt(year.toString(), 10)));

      const data = await db.select().from(payrolls)
        .where(and(...conditions))
        .orderBy(desc(payrolls.periodYear), desc(payrolls.periodMonth), desc(payrolls.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get all payrolls (HR Admin / Super Admin only)
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const { month, year, employeeId } = request.query as {
        month?: string | number;
        year?: string | number;
        employeeId?: string;
      };

      const conditions = [];
      if (month) conditions.push(eq(payrolls.periodMonth, parseInt(month.toString(), 10)));
      if (year) conditions.push(eq(payrolls.periodYear, parseInt(year.toString(), 10)));
      if (employeeId) conditions.push(eq(payrolls.employeeId, employeeId));

      const data = conditions.length > 0
        ? await db.select().from(payrolls).where(and(...conditions)).orderBy(desc(payrolls.createdAt))
        : await db.select().from(payrolls).orderBy(desc(payrolls.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get single payroll (IDOR protected: only owner or HR/Super Admin)
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

      // Only HR/Admin or the owning employee can access
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0 || payroll[0].employeeId !== emp[0].id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
        }
      }

      return reply.send({ success: true, data: payroll[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Download payslip PDF (IDOR protected: only owner or HR/Super Admin)
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

      // Only HR/Admin or the owning employee can download
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        const emp = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0 || payroll[0].employeeId !== emp[0].id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
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

  // Mark payroll as paid (Admin/HR only)
  app.put('/:id/paid', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const { id } = request.params as { id: string };

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

  // Get payroll composition for dashboard chart
  app.get('/composition', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { month, year } = request.query as { month?: string | number; year?: string | number };

      let employeeIdsScope: string[] | null = null;
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        const emp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length === 0) {
          return reply.send({
            success: true,
            data: {
              periodMonth: null,
              periodYear: null,
              totalEmployees: 0,
              totalAmount: 0,
              composition: [
                { name: 'Gaji Pokok', value: 0 },
                { name: 'Lembur', value: 0 },
                { name: 'Tunjangan', value: 0 },
                { name: 'BPJS', value: 0 },
                { name: 'Pajak', value: 0 },
              ],
            },
          });
        }
        employeeIdsScope = [emp[0].id];
      }

      let m: number;
      let y: number;

      if (month && year) {
        m = parseInt(month.toString(), 10);
        y = parseInt(year.toString(), 10);
      } else {
        // Find most recent period available in database for scope
        const scopeConditions = [];
        if (employeeIdsScope !== null) {
          if (employeeIdsScope.length === 0) {
            return reply.send({
              success: true,
              data: {
                periodMonth: null,
                periodYear: null,
                totalEmployees: 0,
                totalAmount: 0,
                composition: [
                  { name: 'Gaji Pokok', value: 0 },
                  { name: 'Lembur', value: 0 },
                  { name: 'Tunjangan', value: 0 },
                  { name: 'BPJS', value: 0 },
                  { name: 'Pajak', value: 0 },
                ],
              },
            });
          }
          scopeConditions.push(inArray(payrolls.employeeId, employeeIdsScope));
        }

        const latest = await db.select({
          month: payrolls.periodMonth,
          year: payrolls.periodYear,
        })
        .from(payrolls)
        .where(scopeConditions.length > 0 ? and(...scopeConditions) : undefined)
        .orderBy(desc(payrolls.periodYear), desc(payrolls.periodMonth))
        .limit(1);

        if (latest.length > 0) {
          m = latest[0].month;
          y = latest[0].year;
        } else {
          const now = new Date();
          m = now.getMonth() + 1;
          y = now.getFullYear();
        }
      }

      const conditions = [
        eq(payrolls.periodMonth, m),
        eq(payrolls.periodYear, y),
      ];

      if (employeeIdsScope !== null) {
        conditions.push(inArray(payrolls.employeeId, employeeIdsScope));
      }

      const records = await db.select().from(payrolls).where(and(...conditions));

      let totalBaseSalary = 0;
      let totalOvertime = 0;
      let totalAllowances = 0;
      let totalBpjs = 0;
      let totalTax = 0;
      let totalNet = 0;

      for (const row of records) {
        totalBaseSalary += parseFloat(row.baseSalary || '0');
        totalOvertime += parseFloat(row.overtimePay || '0');
        totalAllowances += parseFloat(row.allowances || '0');
        totalBpjs += parseFloat(row.bpjsEmployee || '0') + parseFloat(row.bpjsEmployer || '0');
        totalTax += parseFloat(row.taxDeduction || '0');
        totalNet += parseFloat(row.netSalary || '0');
      }

      return reply.send({
        success: true,
        data: {
          periodMonth: m,
          periodYear: y,
          totalEmployees: records.length,
          totalAmount: Math.round(totalNet),
          composition: [
            { name: 'Gaji Pokok', value: Math.round(totalBaseSalary) },
            { name: 'Lembur', value: Math.round(totalOvertime) },
            { name: 'Tunjangan', value: Math.round(totalAllowances) },
            { name: 'BPJS', value: Math.round(totalBpjs) },
            { name: 'Pajak', value: Math.round(totalTax) },
          ],
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
