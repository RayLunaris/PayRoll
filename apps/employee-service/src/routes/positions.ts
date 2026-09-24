import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, positions, positionSalaryAuditLogs, employees, users, eq, desc } from '@payrollpro/db';
import { requireRole } from '../middleware/auth.js';

const createPositionSchema = z.object({
  name: z.string().min(1, 'Nama jabatan wajib diisi'),
  code: z.string().optional(),
  description: z.string().optional(),
  grade: z.string().optional(),
  levelRank: z.coerce.number().int().min(1).default(1),
  baseSalary: z.coerce.number().positive('Gaji pokok harus positif').transform((val) => val.toFixed(2)),
  minSalary: z.coerce
    .number()
    .positive('Rentang minimum harus positif')
    .optional()
    .transform((val) => (val !== undefined ? val.toFixed(2) : undefined)),
  maxSalary: z.coerce
    .number()
    .positive('Rentang maksimum harus positif')
    .optional()
    .transform((val) => (val !== undefined ? val.toFixed(2) : undefined)),
  positionAllowance: z.coerce
    .number()
    .min(0, 'Tunjangan jabatan tidak boleh negatif')
    .optional()
    .default(0)
    .transform((val) => val.toFixed(2)),
});

const updatePositionSchema = createPositionSchema.partial().extend({
  reason: z.string().optional(),
});

function maskPositionForNonAdmin(pos: any) {
  const { baseSalary, minSalary, maxSalary, positionAllowance, ...rest } = pos;
  return rest;
}

export async function positionRoutes(app: FastifyInstance) {
  // Get all positions
  app.get(
    '/',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        const isAdmin = user && ['super_admin', 'hr_admin'].includes(user.role);

        const data = await db.select().from(positions).orderBy(desc(positions.createdAt));
        const filteredData = isAdmin ? data : data.map(maskPositionForNonAdmin);

        return reply.send({ success: true, data: filteredData });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // Get position by ID
  app.get(
    '/:id',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        const isAdmin = user && ['super_admin', 'hr_admin'].includes(user.role);
        const { id } = request.params as { id: string };

        const position = await db.select().from(positions).where(eq(positions.id, id)).limit(1);

        if (position.length === 0) {
          return reply.status(404).send({ success: false, error: 'Position not found' });
        }

        const filtered = isAdmin ? position[0] : maskPositionForNonAdmin(position[0]);
        return reply.send({ success: true, data: filtered });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // Create position (Admin only)
  app.post(
    '/',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createPositionSchema.parse(request.body);
        const newPosition = await db.insert(positions).values(body).returning();
        return reply.status(201).send({ success: true, data: newPosition[0] });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
        }
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // Update position (Admin only)
  app.put(
    '/:id',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const existing = await db.select().from(positions).where(eq(positions.id, id)).limit(1);

        if (existing.length === 0) {
          return reply.status(404).send({ success: false, error: 'Position not found' });
        }

        const oldPos = existing[0];
        const { reason, ...updateData } = updatePositionSchema.parse(request.body);

        const isBaseSalaryChanged =
          updateData.baseSalary !== undefined &&
          parseFloat(updateData.baseSalary) !== parseFloat(oldPos.baseSalary || '0');
        const isAllowanceChanged =
          updateData.positionAllowance !== undefined &&
          parseFloat(updateData.positionAllowance) !== parseFloat(oldPos.positionAllowance || '0');

        const salaryChanged = isBaseSalaryChanged || isAllowanceChanged;

        if (salaryChanged && (!reason || reason.trim().length === 0)) {
          return reply.status(400).send({
            success: false,
            error: 'Alasan perubahan skala gaji (reason) wajib diisi saat memperbarui nominal gaji pokok atau tunjangan jabatan',
          });
        }

        const updated = await db
          .update(positions)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(positions.id, id))
          .returning();

        // Audit Trail Recording
        if (salaryChanged) {
          await db.insert(positionSalaryAuditLogs).values({
            positionId: id,
            changedByUserId: request.user.id,
            oldBaseSalary: oldPos.baseSalary,
            newBaseSalary: updateData.baseSalary ?? oldPos.baseSalary,
            oldAllowance: oldPos.positionAllowance ?? '0.00',
            newAllowance: updateData.positionAllowance ?? oldPos.positionAllowance ?? '0.00',
            reason: reason || 'Penyesuaian skala upah oleh admin',
          });
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

  // Delete position (Admin only)
  app.delete(
    '/:id',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        // Check if any employees are linked to this position
        const assignedEmployees = await db
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.positionId, id))
          .limit(1);

        if (assignedEmployees.length > 0) {
          return reply.status(400).send({
            success: false,
            error: 'Tidak dapat menghapus jabatan karena masih ada karyawan yang terikat dengan jabatan ini',
          });
        }

        const deleted = await db.delete(positions).where(eq(positions.id, id)).returning();

        if (deleted.length === 0) {
          return reply.status(404).send({ success: false, error: 'Position not found' });
        }

        return reply.send({ success: true, message: 'Position deleted successfully' });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );

  // Get position audit logs (Super Admin and HR Admin only)
  app.get(
    '/:id/audit-logs',
    {
      preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const logs = await db
          .select({
            id: positionSalaryAuditLogs.id,
            positionId: positionSalaryAuditLogs.positionId,
            changedByUserId: positionSalaryAuditLogs.changedByUserId,
            userEmail: users.email,
            oldBaseSalary: positionSalaryAuditLogs.oldBaseSalary,
            newBaseSalary: positionSalaryAuditLogs.newBaseSalary,
            oldAllowance: positionSalaryAuditLogs.oldAllowance,
            newAllowance: positionSalaryAuditLogs.newAllowance,
            reason: positionSalaryAuditLogs.reason,
            createdAt: positionSalaryAuditLogs.createdAt,
          })
          .from(positionSalaryAuditLogs)
          .leftJoin(users, eq(positionSalaryAuditLogs.changedByUserId, users.id))
          .where(eq(positionSalaryAuditLogs.positionId, id))
          .orderBy(desc(positionSalaryAuditLogs.createdAt));

        return reply.send({ success: true, data: logs });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  );
}
