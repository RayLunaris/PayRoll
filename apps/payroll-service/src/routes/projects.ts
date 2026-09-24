import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  db,
  projects,
  projectMembers,
  projectExpenses,
  employees,
  users,
  eq,
  and,
  desc,
  sql,
} from '@payrollpro/db';
import { requireRole } from '../middleware/auth.js';

const projectSchema = z.object({
  code: z.string().min(1, 'Kode proyek wajib diisi'),
  name: z.string().min(1, 'Nama proyek wajib diisi'),
  clientName: z.string().optional().nullable(),
  managerUserId: z.string().uuid().optional().nullable(),
  totalBudget: z.coerce.number().positive('Total anggaran proyek harus positif').transform((val) => val.toFixed(2)),
  laborBudget: z.coerce.number().min(0).optional().default(0).transform((val) => val.toFixed(2)),
  operationalBudget: z.coerce.number().min(0).optional().default(0).transform((val) => val.toFixed(2)),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().optional().nullable(),
  status: z.enum(['planning', 'active', 'completed', 'on_hold']).optional().default('active'),
});

const memberSchema = z.object({
  employeeId: z.string().uuid('Pilih karyawan'),
  roleInProject: z.string().min(1, 'Peran proyek wajib diisi'),
  allocationPercentage: z.coerce.number().min(1).max(100).default(100).transform((val) => val.toFixed(2)),
  assignedMonthlyCost: z.coerce.number().min(0).transform((val) => val.toFixed(2)),
  startDate: z.string().min(1, 'Tanggal mulai penugasan wajib diisi'),
  endDate: z.string().optional().nullable(),
});

const expenseSchema = z.object({
  expenseTitle: z.string().min(1, 'Judul pengeluaran wajib diisi'),
  category: z.enum(['cloud_server', 'license', 'travel', 'equipment', 'other']),
  amount: z.coerce.number().positive('Nominal pengeluaran harus positif').transform((val) => val.toFixed(2)),
  expenseDate: z.string().min(1, 'Tanggal pengeluaran wajib diisi'),
  receiptUrl: z.string().optional().nullable(),
});

export async function projectRoutes(app: FastifyInstance) {
  // 1. List Projects
  app.get(
    '/',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin', 'manager')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        const isManagerOnly = user.role === 'manager';

        let query = db
          .select({
            id: projects.id,
            code: projects.code,
            name: projects.name,
            clientName: projects.clientName,
            managerUserId: projects.managerUserId,
            managerEmail: users.email,
            totalBudget: projects.totalBudget,
            laborBudget: projects.laborBudget,
            operationalBudget: projects.operationalBudget,
            spentLabor: projects.spentLabor,
            spentOperational: projects.spentOperational,
            startDate: projects.startDate,
            endDate: projects.endDate,
            status: projects.status,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
          })
          .from(projects)
          .leftJoin(users, eq(projects.managerUserId, users.id))
          .orderBy(desc(projects.createdAt));

        const data = isManagerOnly
          ? await query.where(eq(projects.managerUserId, user.id))
          : await query;

        const enriched = data.map((p) => {
          const totalBudgetNum = parseFloat(p.totalBudget || '0');
          const spentLaborNum = parseFloat(p.spentLabor || '0');
          const spentOperationalNum = parseFloat(p.spentOperational || '0');
          const totalSpent = spentLaborNum + spentOperationalNum;
          const remainingBudget = Math.max(0, totalBudgetNum - totalSpent);
          const usagePercentage = totalBudgetNum > 0 ? (totalSpent / totalBudgetNum) * 100 : 0;

          let statusColor: 'green' | 'yellow' | 'orange' | 'red' = 'green';
          if (usagePercentage >= 100) statusColor = 'red';
          else if (usagePercentage >= 90) statusColor = 'orange';
          else if (usagePercentage >= 75) statusColor = 'yellow';

          return {
            ...p,
            totalSpent,
            remainingBudget,
            usagePercentage: Math.round(usagePercentage * 10) / 10,
            statusColor,
          };
        });

        return reply.send({ success: true, data: enriched });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // 2. Get Project Detail
  app.get(
    '/:id',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin', 'manager')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const user = request.user;

        const projectData = await db
          .select({
            id: projects.id,
            code: projects.code,
            name: projects.name,
            clientName: projects.clientName,
            managerUserId: projects.managerUserId,
            managerEmail: users.email,
            totalBudget: projects.totalBudget,
            laborBudget: projects.laborBudget,
            operationalBudget: projects.operationalBudget,
            spentLabor: projects.spentLabor,
            spentOperational: projects.spentOperational,
            startDate: projects.startDate,
            endDate: projects.endDate,
            status: projects.status,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
          })
          .from(projects)
          .leftJoin(users, eq(projects.managerUserId, users.id))
          .where(eq(projects.id, id))
          .limit(1);

        if (projectData.length === 0) {
          return reply.status(404).send({ success: false, error: 'Project not found' });
        }

        const project = projectData[0];

        // Access check for manager: only see own project
        if (user.role === 'manager' && project.managerUserId !== user.id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
        }

        // Fetch team members
        const members = await db
          .select({
            id: projectMembers.id,
            projectId: projectMembers.projectId,
            employeeId: projectMembers.employeeId,
            employeeNip: employees.nip,
            employeeName: employees.fullName,
            roleInProject: projectMembers.roleInProject,
            allocationPercentage: projectMembers.allocationPercentage,
            assignedMonthlyCost: projectMembers.assignedMonthlyCost,
            startDate: projectMembers.startDate,
            endDate: projectMembers.endDate,
            createdAt: projectMembers.createdAt,
          })
          .from(projectMembers)
          .leftJoin(employees, eq(projectMembers.employeeId, employees.id))
          .where(eq(projectMembers.projectId, id));

        // Fetch expenses
        const expenses = await db
          .select({
            id: projectExpenses.id,
            projectId: projectExpenses.projectId,
            expenseTitle: projectExpenses.expenseTitle,
            category: projectExpenses.category,
            amount: projectExpenses.amount,
            expenseDate: projectExpenses.expenseDate,
            receiptUrl: projectExpenses.receiptUrl,
            submittedByUserId: projectExpenses.submittedByUserId,
            submittedByEmail: users.email,
            status: projectExpenses.status,
            createdAt: projectExpenses.createdAt,
          })
          .from(projectExpenses)
          .leftJoin(users, eq(projectExpenses.submittedByUserId, users.id))
          .where(eq(projectExpenses.projectId, id))
          .orderBy(desc(projectExpenses.expenseDate));

        const totalBudgetNum = parseFloat(project.totalBudget || '0');
        const spentLaborNum = parseFloat(project.spentLabor || '0');
        const spentOperationalNum = parseFloat(project.spentOperational || '0');
        const totalSpent = spentLaborNum + spentOperationalNum;
        const remainingBudget = Math.max(0, totalBudgetNum - totalSpent);
        const usagePercentage = totalBudgetNum > 0 ? (totalSpent / totalBudgetNum) * 100 : 0;

        return reply.send({
          success: true,
          data: {
            ...project,
            totalSpent,
            remainingBudget,
            usagePercentage: Math.round(usagePercentage * 10) / 10,
            members,
            expenses,
          },
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // 3. Create Project (Super Admin & HR Admin only)
  app.post(
    '/',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = projectSchema.parse(request.body);
        const [newProject] = await db.insert(projects).values(body).returning();
        return reply.status(201).send({ success: true, data: newProject });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
        }
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // 4. Update Project (Super Admin & HR Admin)
  app.put(
    '/:id',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = projectSchema.partial().parse(request.body);

        const updated = await db
          .update(projects)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(projects.id, id))
          .returning();

        if (updated.length === 0) {
          return reply.status(404).send({ success: false, error: 'Project not found' });
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

  // 5. Delete Project (Super Admin only)
  app.delete(
    '/:id',
    {
      preHandler: [app.authenticate, requireRole('super_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const deleted = await db.delete(projects).where(eq(projects.id, id)).returning();
        if (deleted.length === 0) {
          return reply.status(404).send({ success: false, error: 'Project not found' });
        }
        return reply.send({ success: true, message: 'Project deleted successfully' });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // 6. Assign Member to Project
  app.post(
    '/:id/members',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = memberSchema.parse(request.body);

        // Verify project exists
        const proj = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
        if (proj.length === 0) {
          return reply.status(404).send({ success: false, error: 'Project not found' });
        }

        const [newMember] = await db
          .insert(projectMembers)
          .values({
            projectId: id,
            ...body,
          })
          .returning();

        return reply.status(201).send({ success: true, data: newMember });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
        }
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // 7. Remove Member from Project
  app.delete(
    '/:id/members/:memberId',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, memberId } = request.params as { id: string; memberId: string };
        const deleted = await db
          .delete(projectMembers)
          .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, id)))
          .returning();

        if (deleted.length === 0) {
          return reply.status(404).send({ success: false, error: 'Project member not found' });
        }

        return reply.send({ success: true, message: 'Member removed from project' });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // 8. Record Project Expense
  app.post(
    '/:id/expenses',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin', 'manager')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const user = request.user;
        const body = expenseSchema.parse(request.body);

        const [proj] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
        if (!proj) {
          return reply.status(404).send({ success: false, error: 'Project not found' });
        }

        if (user.role === 'manager' && proj.managerUserId !== user.id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
        }

        const [newExpense] = await db
          .insert(projectExpenses)
          .values({
            projectId: id,
            submittedByUserId: user.id,
            ...body,
          })
          .returning();

        // Increment spentOperational on project
        const currentSpent = parseFloat(proj.spentOperational || '0');
        const addAmount = parseFloat(body.amount);
        const newSpent = (currentSpent + addAmount).toFixed(2);

        await db
          .update(projects)
          .set({ spentOperational: newSpent, updatedAt: new Date() })
          .where(eq(projects.id, id));

        return reply.status(201).send({ success: true, data: newExpense });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
        }
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );
}
