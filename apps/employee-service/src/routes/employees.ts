import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  db,
  employees,
  departments,
  positions,
  workLocations,
  users,
  leaveQuotas,
  leaves,
  attendances,
  abuseLogs,
  cashAdvances,
  employeeShifts,
  shiftSwaps,
  overtimeRequests,
  projectMembers,
  payrolls,
  passwordResetTokens,
  notifications,
  messages,
  socialLikes,
  socialComments,
  socialPosts,
  eq,
  and,
  or,
  desc,
  sql,
} from '@payrollpro/db';
import type { SQL } from '@payrollpro/db';
import { requireRole } from '../middleware/auth.js';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const optionalNullableString = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().nullable().optional()
);

const optionalDateString = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().regex(dateRegex, 'Format tanggal harus YYYY-MM-DD').nullable().optional()
);

const employeeSchema = z.object({
  userId: z.string().uuid().optional(),
  nip: z.string().min(1, 'NIP is required'),
  fullName: z.string().min(1, 'Full name is required'),
  departmentId: z.string().uuid('Valid departmentId is required'),
  positionId: z.string().uuid('Valid positionId is required'),
  locationId: z.string().uuid('Valid locationId is required'),
  phone: optionalNullableString,
  address: optionalNullableString,
  birthDate: optionalDateString,
  joinDate: z.string().regex(dateRegex, 'joinDate must be in YYYY-MM-DD format'),
  baseSalary: z.coerce.number().positive('baseSalary must be a positive number').transform(val => val.toFixed(2)),
  npwp: optionalNullableString,
  bankName: optionalNullableString,
  bankAccount: optionalNullableString,
  photoUrl: optionalNullableString,
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

  // Get current user's employee profile
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const conditions = [eq(employees.userId, user.id)];
      if ((user as any).employeeId) {
        conditions.push(eq(employees.id, (user as any).employeeId));
      }
      const result = await db.select().from(employees).where(or(...conditions)).limit(1);

      if (result.length === 0) {
        // Auto-provision if missing for logged-in user
        const [depts, pos, locs, allEmps] = await Promise.all([
          db.select().from(departments),
          db.select().from(positions),
          db.select().from(workLocations),
          db.select({ nip: employees.nip }).from(employees),
        ]);
        const defaultDept = depts.find(d => d.name.toLowerCase().includes('information') || d.name.toLowerCase().includes('it')) || depts[0];
        const defaultPos = pos.find(p => p.name.toLowerCase().includes('staff')) || pos[0];
        const defaultLoc = locs[0];

        let nextNum = 1;
        for (const emp of allEmps) {
          const match = emp.nip.match(/^EMP(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num >= nextNum) nextNum = num + 1;
          }
        }
        const nip = 'EMP' + String(nextNum).padStart(3, '0');
        const today = new Date().toISOString().split('T')[0];
        const rawName = user.email.split('@')[0];
        const fullName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

        const [newEmp] = await db.insert(employees).values({
          userId: user.id,
          nip,
          fullName,
          departmentId: defaultDept?.id,
          positionId: defaultPos?.id,
          locationId: defaultLoc?.id,
          joinDate: today,
          baseSalary: '8000000.00',
          isActive: true,
        }).returning();

        await db.update(users).set({ employeeId: newEmp.id }).where(eq(users.id, user.id));

        return reply.send({ success: true, data: newEmp });
      }

      return reply.send({ success: true, data: result[0] });
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

      if (id === 'me') {
        const conditions = [eq(employees.userId, user.id)];
        if ((user as any).employeeId) {
          conditions.push(eq(employees.id, (user as any).employeeId));
        }
        const result = await db.select().from(employees).where(or(...conditions)).limit(1);
        if (result.length === 0) {
          return reply.status(404).send({ success: false, error: 'Employee not found' });
        }
        return reply.send({ success: true, data: result[0] });
      }

      const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);

      if (result.length === 0) {
        return reply.status(404).send({ success: false, error: 'Employee not found' });
      }

      if (user.role === 'employee') {
        const target = result[0];
        const isOwn =
          target.userId === user.id ||
          target.id === (user as any).employeeId ||
          ((user as any).employeeId && (user as any).employeeId === id);

        if (!isOwn) {
          const own = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
          if (own.length === 0 || own[0].id !== id) {
            return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
          }
        }
      } else if (user.role === 'manager') {
        const target = result[0];
        const isSelf =
          target.userId === user.id ||
          target.id === (user as any).employeeId ||
          ((user as any).employeeId && (user as any).employeeId === id);

        if (!isSelf) {
          const mgr = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
          const sameDept = mgr.length > 0 && !!mgr[0].departmentId && !!target.departmentId && target.departmentId === mgr[0].departmentId;
          const isOwnDept = mgr.length > 0 && mgr[0].id === id;
          if (!sameDept && !isOwnDept) {
            return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
          }
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

      // Sync isActive status to linked user account if present
      if (body.isActive !== undefined) {
        if (updated[0].userId) {
          await db.update(users).set({ isActive: body.isActive }).where(eq(users.id, updated[0].userId));
        }
        await db.update(users).set({ isActive: body.isActive }).where(eq(users.employeeId, id));
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

      return await db.transaction(async (tx) => {
        // 1. Check employee existence
        const [targetEmployee] = await tx
          .select()
          .from(employees)
          .where(eq(employees.id, id))
          .limit(1);

        if (!targetEmployee) {
          return reply.status(404).send({ success: false, error: 'Employee not found' });
        }

        // 2. Prevent self-deletion
        const currentUser = request.user;
        if (targetEmployee.userId === currentUser.id || targetEmployee.id === (currentUser as any).employeeId) {
          return reply.status(400).send({ success: false, error: 'Tidak dapat menghapus akun Anda sendiri' });
        }

        // 3. Check for financial / payroll history
        const [hasPayroll] = await tx
          .select({ count: sql<string>`count(*)` })
          .from(payrolls)
          .where(eq(payrolls.employeeId, id));

        const payrollCount = parseInt(hasPayroll?.count || '0', 10);
        const isForce =
          ((request.query as any)?.force === 'true' || (request.query as any)?.force === true) &&
          currentUser.role === 'super_admin';

        if (payrollCount > 0) {
          if (!isForce) {
            return reply.status(400).send({
              success: false,
              hasPayroll: true,
              canForce: currentUser.role === 'super_admin',
              error:
                'Karyawan tidak dapat dihapus permanen karena sudah memiliki riwayat penggajian (payroll). Silakan ubah status karyawan menjadi Nonaktif.',
            });
          }
          // Force delete: remove payroll records for test data cleanup
          await tx.delete(payrolls).where(eq(payrolls.employeeId, id));
        }

        // 4. Cascade delete employee-dependent records
        await tx.delete(leaveQuotas).where(eq(leaveQuotas.employeeId, id));
        await tx.delete(leaves).where(eq(leaves.employeeId, id));
        await tx.delete(attendances).where(eq(attendances.employeeId, id));
        await tx.delete(abuseLogs).where(eq(abuseLogs.employeeId, id));
        await tx.delete(cashAdvances).where(eq(cashAdvances.employeeId, id));
        await tx.delete(employeeShifts).where(eq(employeeShifts.employeeId, id));
        await tx.delete(shiftSwaps).where(or(eq(shiftSwaps.requesterId, id), eq(shiftSwaps.targetId, id)));
        await tx.delete(overtimeRequests).where(eq(overtimeRequests.employeeId, id));
        await tx.delete(projectMembers).where(eq(projectMembers.employeeId, id));

        // 5. Unlink any user pointing to this employee
        await tx.update(users).set({ employeeId: null }).where(eq(users.employeeId, id));

        // 6. Delete employee record
        await tx.delete(employees).where(eq(employees.id, id));

        // 7. If employee has an associated user account, delete user if employee role
        if (targetEmployee.userId) {
          const [associatedUser] = await tx
            .select()
            .from(users)
            .where(eq(users.id, targetEmployee.userId))
            .limit(1);

          if (associatedUser) {
            if (associatedUser.role === 'employee') {
              // Delete user-related activity/records first
              await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, associatedUser.id));
              await tx.delete(notifications).where(eq(notifications.userId, associatedUser.id));
              await tx.delete(messages).where(or(eq(messages.senderId, associatedUser.id), eq(messages.receiverId, associatedUser.id)));
              await tx.delete(socialLikes).where(eq(socialLikes.userId, associatedUser.id));
              await tx.delete(socialComments).where(eq(socialComments.userId, associatedUser.id));
              await tx.delete(socialPosts).where(eq(socialPosts.userId, associatedUser.id));
              await tx.delete(users).where(eq(users.id, associatedUser.id));
            } else {
              // If associated user is an admin or manager, only unlink employeeId
              await tx.update(users).set({ employeeId: null }).where(eq(users.id, associatedUser.id));
            }
          }
        }

        return reply.send({ success: true, message: 'Employee and user account successfully deleted' });
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error?.message || 'Gagal menghapus karyawan karena dependensi data terkait.',
      });
    }
  });

  // Get active employee IDs by department (helper for department scoping in manager views)
  app.get('/by-department/:departmentId', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { departmentId } = request.params as { departmentId: string };
      const team = await db.select({ id: employees.id }).from(employees)
        .where(and(eq(employees.departmentId, departmentId), eq(employees.isActive, true)));
      return reply.send({ success: true, data: team.map((t) => t.id) });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
