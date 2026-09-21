import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, employees, departments, positions, workLocations, eq, and, desc, sql } from '@payrollpro/db';
import type { SQL } from '@payrollpro/db';
import { requireRole } from '../middleware/auth.js';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const employeeSchema = z.object({
  userId: z.string().uuid().optional(),
  nip: z.string().min(1, 'NIP is required'),
  fullName: z.string().min(1, 'Full name is required'),
  departmentId: z.string().uuid('Valid departmentId is required'),
  positionId: z.string().uuid('Valid positionId is required'),
  locationId: z.string().uuid('Valid locationId is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  birthDate: z.string().regex(dateRegex, 'birthDate must be in YYYY-MM-DD format').optional(),
  joinDate: z.string().regex(dateRegex, 'joinDate must be in YYYY-MM-DD format'),
  baseSalary: z.coerce.number().positive('baseSalary must be a positive number').transform(val => val.toFixed(2)),
  npwp: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  photoUrl: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

async function validateForeignKeys(departmentId?: string, positionId?: string, locationId?: string): Promise<string | null> {
  if (departmentId) {
    const [dept] = await db.select({ id: departments.id }).from(departments).where(eq(departments.id, departmentId)).limit(1);
    if (!dept) return 'Department not found';
  }
  if (positionId) {
    const [pos] = await db.select({ id: positions.id }).from(positions).where(eq(positions.id, positionId)).limit(1);
    if (!pos) return 'Position not found';
  }
  if (locationId) {
    const [loc] = await db.select({ id: workLocations.id }).from(workLocations).where(eq(workLocations.id, locationId)).limit(1);
    if (!loc) return 'Location not found';
  }
  return null;
}

const MANAGEMENT_ROLES = ['super_admin', 'hr_admin', 'manager'] as const;

export async function employeeRoutes(app: FastifyInstance) {
  // Get all employees with pagination and search (HR / Manager only)
  app.get('/', {
    preHandler: [app.authenticate, requireRole(...MANAGEMENT_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const query = (request.query as { page?: string; limit?: string; search?: string }) || {};
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(200, Math.max(1, parseInt(query.limit || '10', 10)));
      const search = query.search ? query.search.trim() : '';
      const offset = (page - 1) * limit;

      const conditions: SQL[] = [];
      if (user.role === 'manager') {
        // Managers are scoped to their own department
        const mgr = await db.select({ departmentId: employees.departmentId }).from(employees)
          .where(eq(employees.userId, user.id)).limit(1);
        const deptId = mgr.length > 0 ? mgr[0].departmentId : null;
        if (!deptId) {
          return reply.send({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 1 } });
        }
        conditions.push(eq(employees.departmentId, deptId));
      }

      if (search) {
        conditions.push(sql`(${employees.fullName} ILIKE ${`%${search}%`} OR ${employees.nip} ILIKE ${`%${search}%`})`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [data, countResult] = await Promise.all([
        db.select().from(employees).where(whereClause)
          .orderBy(desc(employees.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<string>`count(*)` }).from(employees).where(whereClause),
      ]);

      const total = parseInt(countResult[0]?.count || '0', 10);

      return reply.send({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Get employee by ID (own record only for employees; HR/Manager any)
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };
      const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);

      if (result.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      if (user.role === 'employee') {
        const own = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (own.length === 0 || own[0].id !== id) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
        }
      } else if (user.role === 'manager') {
        const target = result[0];
        const mgr = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
        const sameDept = mgr.length > 0 && !!mgr[0].departmentId && !!target.departmentId && target.departmentId === mgr[0].departmentId;
        const isSelf = mgr.length > 0 && mgr[0].id === id;
        if (!sameDept && !isSelf) {
          return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
        }
      }

      return reply.send({ success: true, data: result[0] });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Create employee (Admin only with RBAC)
  app.post('/', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = employeeSchema.parse(request.body);
      
      // Validate foreign keys
      const fkError = await validateForeignKeys(body.departmentId, body.positionId, body.locationId);
      if (fkError) {
        return reply.status(400).send({ success: false, error: fkError });
      }

      // Check duplicate NIP
      const existingNip = await db.select().from(employees).where(eq(employees.nip, body.nip)).limit(1);
      if (existingNip.length > 0) {
        return reply.status(409).send({ success: false, error: 'Employee with this NIP already exists' });
      }

      const newEmployee = await db.insert(employees).values(body).returning();
      
      return reply.status(201).send({ success: true, data: newEmployee[0] });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        return reply.status(409).send({ success: false, error: 'Employee with this NIP already exists' });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Update employee (Admin only with RBAC)
  app.put('/:id', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = employeeSchema.partial().parse(request.body);
      
      // Validate foreign keys if provided
      if (body.departmentId || body.positionId || body.locationId) {
        const fkError = await validateForeignKeys(body.departmentId, body.positionId, body.locationId);
        if (fkError) {
          return reply.status(400).send({ success: false, error: fkError });
        }
      }

      const updated = await db.update(employees).set(body).where(eq(employees.id, id)).returning();
      
      if (updated.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        return reply.status(409).send({ success: false, error: 'Employee with this NIP already exists' });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Delete employee (Admin only with RBAC)
  app.delete('/:id', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await db.delete(employees).where(eq(employees.id, id)).returning();
      
      if (deleted.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      return reply.send({ success: true, message: 'Employee deleted' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
