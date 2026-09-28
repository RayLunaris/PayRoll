import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, departments, eq, desc, getCached, invalidateCache } from '@payrollpro/db';
import { requireRole } from '../middleware/auth.js';

const departmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  managerId: z.string().uuid().optional(),
});

export async function departmentRoutes(app: FastifyInstance) {
  // Get all departments (cached)
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page, limit } = request.query as { page?: string; limit?: string };
      const parsedLimit = limit ? Math.min(200, Math.max(1, parseInt(limit, 10))) : undefined;
      const parsedPage = page ? Math.max(1, parseInt(page, 10)) : 1;
      const offset = parsedLimit ? (parsedPage - 1) * parsedLimit : undefined;

      const cacheKey = parsedLimit ? `master:departments:p${parsedPage}:l${parsedLimit}` : 'master:departments:all';

      const data = await getCached(cacheKey, 600, async () => {
        const query = db.select().from(departments).orderBy(desc(departments.createdAt));
        return parsedLimit ? await query.limit(parsedLimit).offset(offset!) : await query;
      });

      return reply.send({
        success: true,
        data,
        ...(parsedLimit ? { pagination: { page: parsedPage, limit: parsedLimit } } : {}),
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get department by ID
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const department = await db.select().from(departments).where(eq(departments.id, id)).limit(1);

      if (department.length === 0) {
        return reply.status(404).send({ success: false, error: 'Department not found' });
      }

      return reply.send({ success: true, data: department[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Create department (Admin only)
  app.post('/', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = departmentSchema.parse(request.body);
      const newDepartment = await db.insert(departments).values(body).returning();
      await invalidateCache('master:departments:*');
      return reply.status(201).send({ success: true, data: newDepartment[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Update department (Admin only)
  app.put('/:id', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = departmentSchema.partial().parse(request.body);
      const updated = await db.update(departments).set(body).where(eq(departments.id, id)).returning();

      if (updated.length === 0) {
        return reply.status(404).send({ success: false, error: 'Department not found' });
      }

      await invalidateCache('master:departments:*');
      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Delete department (Admin only)
  app.delete('/:id', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await db.delete(departments).where(eq(departments.id, id)).returning();

      if (deleted.length === 0) {
        return reply.status(404).send({ success: false, error: 'Department not found' });
      }

      await invalidateCache('master:departments:*');
      return reply.send({ success: true, message: 'Department deleted' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
