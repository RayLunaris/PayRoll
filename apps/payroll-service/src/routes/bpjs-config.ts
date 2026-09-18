import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, bpjsConfig, eq, desc } from '@payrollpro/db';

const ADMIN_ROLES = ['hr_admin', 'super_admin'];

const decimalOrString = z
  .union([z.number(), z.string()])
  .transform((val) => String(val));

const bpjsSchema = z.object({
  component: z.string().min(1).optional(),
  employeeRate: decimalOrString.optional(),
  employerRate: decimalOrString.optional(),
  maxSalaryCap: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === null ? null : String(val);
    }),
  isActive: z.boolean().optional(),
});

export async function bpjsConfigRoutes(app: FastifyInstance) {
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
      const data = await db.select().from(bpjsConfig).orderBy(desc(bpjsConfig.effectiveDate));
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
      const body = bpjsSchema.parse(request.body);
      const created = await db.insert(bpjsConfig).values({
        ...body,
        component: body.component || '',
        employeeRate: body.employeeRate || '0',
        employerRate: body.employerRate || '0',
        effectiveDate: '2024-01-01',
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
      const body = bpjsSchema.parse(request.body);
      const updated = await db.update(bpjsConfig).set(body).where(eq(bpjsConfig.id, id)).returning();

      if (updated.length === 0) {
        return reply.status(404).send({ success: false, error: 'BPJS config not found' });
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
      const deleted = await db.delete(bpjsConfig).where(eq(bpjsConfig.id, id)).returning();

      if (deleted.length === 0) {
        return reply.status(404).send({ success: false, error: 'BPJS config not found' });
      }

      return reply.send({ success: true, message: 'BPJS config deleted' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}