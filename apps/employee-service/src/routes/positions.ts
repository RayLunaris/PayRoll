import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, positions, eq, desc } from '@payrollpro/db';
import { requireRole } from '../middleware/auth.js';

const positionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  baseSalary: z.coerce.number().positive('baseSalary must be positive').transform(val => val.toFixed(2)),
  grade: z.string().optional(),
});

export async function positionRoutes(app: FastifyInstance) {
  // Get all positions
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(positions).orderBy(desc(positions.createdAt));
      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get position by ID
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const position = await db.select().from(positions).where(eq(positions.id, id)).limit(1);
      
      if (position.length === 0) {
        return reply.status(404).send({ success: false, error: 'Position not found' });
      }

      return reply.send({ success: true, data: position[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Create position (Admin only)
  app.post('/', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = positionSchema.parse(request.body);
      const newPosition = await db.insert(positions).values(body).returning();
      return reply.status(201).send({ success: true, data: newPosition[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Update position (Admin only)
  app.put('/:id', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = positionSchema.partial().parse(request.body);
      const updated = await db.update(positions).set(body).where(eq(positions.id, id)).returning();
      
      if (updated.length === 0) {
        return reply.status(404).send({ success: false, error: 'Position not found' });
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

  // Delete position (Admin only)
  app.delete('/:id', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await db.delete(positions).where(eq(positions.id, id)).returning();
      
      if (deleted.length === 0) {
        return reply.status(404).send({ success: false, error: 'Position not found' });
      }

      return reply.send({ success: true, message: 'Position deleted' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
