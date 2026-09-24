import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  db,
  budgets,
  departments,
  payrolls,
  projects,
  employees,
  positions,
  eq,
  and,
  desc,
  sql,
} from '@payrollpro/db';
import { requireRole } from '../middleware/auth.js';

const budgetSchema = z.object({
  name: z.string().min(1, 'Nama anggaran wajib diisi'),
  periodYear: z.coerce.number().int().min(2020),
  periodMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
  category: z.enum(['payroll', 'project', 'department', 'general']),
  departmentId: z.string().uuid().optional().nullable(),
  allocatedAmount: z.coerce.number().positive('Nominal alokasi harus positif').transform((val) => val.toFixed(2)),
  notes: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'closed', 'exceeded']).optional().default('active'),
});

export async function budgetRoutes(app: FastifyInstance) {
  // 1. Executive Summary Endpoint
  app.get(
    '/summary',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { year } = request.query as { year?: string };
        const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

        const allBudgets = await db
          .select()
          .from(budgets)
          .where(eq(budgets.periodYear, targetYear));

        let totalAllocated = 0;
        let totalSpent = 0;
        let totalPayrollSpent = 0;
        let totalProjectSpent = 0;

        for (const b of allBudgets) {
          const allocated = parseFloat(b.allocatedAmount || '0');
          const spent = parseFloat(b.spentAmount || '0');
          totalAllocated += allocated;
          totalSpent += spent;

          if (b.category === 'payroll') {
            totalPayrollSpent += spent;
          } else if (b.category === 'project') {
            totalProjectSpent += spent;
          }
        }

        // Also cross-reference actual payrolls paid/processed in targetYear if budgets spent is 0
        const payrollSummary = await db
          .select({
            totalNet: sql<string>`coalesce(sum(${payrolls.netSalary}), 0)`,
          })
          .from(payrolls)
          .where(and(eq(payrolls.periodYear, targetYear), sql`${payrolls.status} in ('processed', 'paid')`));

        const actualPayrollYTD = parseFloat(payrollSummary[0]?.totalNet || '0');
        if (totalPayrollSpent === 0 && actualPayrollYTD > 0) {
          totalPayrollSpent = actualPayrollYTD;
        }

        // Cross-reference project expenses
        const projectSummary = await db
          .select({
            totalSpent: sql<string>`coalesce(sum(${projects.spentLabor} + ${projects.spentOperational}), 0)`,
          })
          .from(projects);

        const actualProjectYTD = parseFloat(projectSummary[0]?.totalSpent || '0');
        if (totalProjectSpent === 0 && actualProjectYTD > 0) {
          totalProjectSpent = actualProjectYTD;
        }

        const effectiveTotalSpent = Math.max(totalSpent, totalPayrollSpent + totalProjectSpent);
        const remainingBudget = Math.max(0, totalAllocated - effectiveTotalSpent);
        const usagePercentage = totalAllocated > 0 ? (effectiveTotalSpent / totalAllocated) * 100 : 0;

        let statusColor: 'green' | 'yellow' | 'orange' | 'red' = 'green';
        if (usagePercentage >= 100) {
          statusColor = 'red';
        } else if (usagePercentage >= 90) {
          statusColor = 'orange';
        } else if (usagePercentage >= 75) {
          statusColor = 'yellow';
        }

        return reply.send({
          success: true,
          data: {
            year: targetYear,
            totalAllocated,
            totalSpent: effectiveTotalSpent,
            totalPayrollSpent,
            totalProjectSpent,
            remainingBudget,
            usagePercentage: Math.round(usagePercentage * 10) / 10,
            statusColor,
          },
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({ success: false, error: (error as any)?.message || 'Internal server error' });
      }
    }
  );

  // 2. Pre-check Payroll Overbudget Guardrail
  app.get(
    '/check-payroll',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { month, year } = request.query as { month?: string; year?: string };
        const reqMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;
        const reqYear = year ? parseInt(year, 10) : new Date().getFullYear();

        // Find applicable payroll budget: either specific month or whole year
        const applicableBudgets = await db
          .select()
          .from(budgets)
          .where(
            and(
              eq(budgets.periodYear, reqYear),
              eq(budgets.category, 'payroll'),
              sql`(${budgets.periodMonth} is null or ${budgets.periodMonth} = ${reqMonth})`
            )
          );

        let totalAllocated = 0;
        let totalSpent = 0;
        for (const b of applicableBudgets) {
          totalAllocated += parseFloat(b.allocatedAmount || '0');
          totalSpent += parseFloat(b.spentAmount || '0');
        }

        const remainingBudget = Math.max(0, totalAllocated - totalSpent);

        // Estimate payroll cost from active employees base salary + position allowances
        const activeEmployees = await db
          .select({
            empBaseSalary: employees.baseSalary,
            posBaseSalary: positions.baseSalary,
            posAllowance: positions.positionAllowance,
          })
          .from(employees)
          .leftJoin(positions, eq(employees.positionId, positions.id))
          .where(eq(employees.isActive, true));

        let estimatedPayroll = 0;
        for (const emp of activeEmployees) {
          const base = parseFloat(emp.empBaseSalary || emp.posBaseSalary || '0');
          const allowance = parseFloat(emp.posAllowance || '0') + Math.round(base * 0.05);
          estimatedPayroll += base + allowance;
        }

        const isOverbudget = totalAllocated > 0 && estimatedPayroll > remainingBudget;
        const excessAmount = isOverbudget ? estimatedPayroll - remainingBudget : 0;

        return reply.send({
          success: true,
          data: {
            month: reqMonth,
            year: reqYear,
            hasBudget: totalAllocated > 0,
            totalAllocated,
            totalSpent,
            remainingBudget,
            estimatedPayroll,
            isOverbudget,
            excessAmount,
            message: isOverbudget
              ? `Total estimasi payroll (Rp ${estimatedPayroll.toLocaleString('id-ID')}) melebihi sisa anggaran (Rp ${remainingBudget.toLocaleString('id-ID')}) sebesar Rp ${excessAmount.toLocaleString('id-ID')}`
              : 'Anggaran mencukupi untuk pemrosesan payroll.',
          },
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({ success: false, error: (error as any)?.message || 'Internal server error' });
      }
    }
  );

  // 3. List All Budgets
  app.get(
    '/',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { year, category, departmentId } = request.query as {
          year?: string;
          category?: string;
          departmentId?: string;
        };

        const conditions = [];
        if (year) conditions.push(eq(budgets.periodYear, parseInt(year, 10)));
        if (category) conditions.push(eq(budgets.category, category));
        if (departmentId) conditions.push(eq(budgets.departmentId, departmentId));

        const query = db
          .select({
            id: budgets.id,
            name: budgets.name,
            periodYear: budgets.periodYear,
            periodMonth: budgets.periodMonth,
            category: budgets.category,
            departmentId: budgets.departmentId,
            departmentName: departments.name,
            allocatedAmount: budgets.allocatedAmount,
            spentAmount: budgets.spentAmount,
            notes: budgets.notes,
            status: budgets.status,
            createdAt: budgets.createdAt,
            updatedAt: budgets.updatedAt,
          })
          .from(budgets)
          .leftJoin(departments, eq(budgets.departmentId, departments.id))
          .orderBy(desc(budgets.periodYear), desc(budgets.createdAt));

        const data = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
        return reply.send({ success: true, data });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({ success: false, error: (error as any)?.message || 'Internal server error' });
      }
    }
  );

  // 4. Create Budget Allocation (Super Admin only)
  app.post(
    '/',
    {
      preHandler: [app.authenticate, requireRole('super_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = budgetSchema.parse(request.body);
        const [newBudget] = await db.insert(budgets).values(body).returning();
        return reply.status(201).send({ success: true, data: newBudget });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
        }
        console.error('Error in POST /api/budgets:', error);
        return reply.status(500).send({ success: false, error: (error as any)?.message || 'Internal server error' });
      }
    }
  );

  // 5. Update Budget (Super Admin only)
  app.put(
    '/:id',
    {
      preHandler: [app.authenticate, requireRole('super_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = budgetSchema.partial().parse(request.body);

        const updated = await db
          .update(budgets)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(budgets.id, id))
          .returning();

        if (updated.length === 0) {
          return reply.status(404).send({ success: false, error: 'Budget not found' });
        }

        return reply.send({ success: true, data: updated[0] });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
        }
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // 6. Delete Budget (Super Admin only)
  app.delete(
    '/:id',
    {
      preHandler: [app.authenticate, requireRole('super_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const existing = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1);
        if (existing.length === 0) {
          return reply.status(404).send({ success: false, error: 'Budget not found' });
        }

        if (parseFloat(existing[0].spentAmount || '0') > 0) {
          return reply.status(400).send({
            success: false,
            error: 'Tidak dapat menghapus anggaran yang sudah memiliki realisasi pengeluaran',
          });
        }

        await db.delete(budgets).where(eq(budgets.id, id));
        return reply.send({ success: true, message: 'Budget deleted successfully' });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );
}
