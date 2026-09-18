import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, overtimeRates, eq, asc } from '@payrollpro/db';

const ADMIN_ROLES = ['hr_admin', 'super_admin'];

const overtimeSchema = z.object({
  name: z.string().min(1).optional(),
  multiplier: z
    .union([z.number(), z.string()])
    .transform((val) => String(val))
    .optional(),
  dayType: z.string().max(20).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function overtimeRateRoutes(app: FastifyInstance) {
  const guard = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
    }
  };

  app.get('/', {
    preHandler: [app.authenticate, guard],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(overtimeRates).orderBy(asc(overtimeRates.name));
      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  app.post('/', {
    preHandler: [app.authenticate, guard],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = overtimeSchema.parse(request.body);
      const created = await db.insert(overtimeRates).values({
        name: body.name || 'New rate',
        multiplier: body.multiplier || '1.5',
        dayType: body.dayType || null,
        isActive: body.isActive ?? true,
      }).returning();
      return reply.status(201).send({ success: true, data: created[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  app.put('/:id', {
    preHandler: [app.authenticate, guard],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = overtimeSchema.parse(request.body);
      const updated = await db.update(overtimeRates).set(body).where(eq(overtimeRates.id, id)).returning();

      if (updated.length === 0) {
        return reply.status(404).send({ success: false, error: 'Overtime rate not found' });
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

  app.delete('/:id', {
    preHandler: [app.authenticate, guard],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await db.delete(overtimeRates).where(eq(overtimeRates.id, id)).returning();

      if (deleted.length === 0) {
        return reply.status(404).send({ success: false, error: 'Overtime rate not found' });
      }

      return reply.send({ success: true, message: 'Overtime rate deleted' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}