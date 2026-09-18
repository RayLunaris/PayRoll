import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { hash, compare } from 'bcrypt';
import { db, users, employees, eq, desc } from '@payrollpro/db';
import { UserRole } from '@payrollpro/shared-types';
import { requireRole } from '../middleware/auth.js';
import {
  generateJti,
  storeRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
  revokeAllUserTokens,
} from '../services/token-store.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

// Register schema strictly disallows choosing roles (K4 fix: all self-registrations become employee)
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  employeeId: z.string().uuid().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(6).max(72),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  role: z.enum(['super_admin', 'hr_admin', 'manager', 'employee']),
});

const updateUserRoleSchema = z.object({
  role: z.enum(['super_admin', 'hr_admin', 'manager', 'employee']),
});

export async function authRoutes(app: FastifyInstance) {
  // Login with rate limit & refresh token rotation setup
  app.post('/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);
      
      // Find user by email
      const result = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
      
      if (result.length === 0) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }

      const user = result[0];

      if (!user.isActive) {
        return reply.status(403).send({ success: false, error: 'Account is deactivated' });
      }

      // Verify password
      const isValid = await compare(body.password, user.passwordHash);
      
      if (!isValid) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }

      // Generate tokens with jti for rotation tracking
      const accessToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role as UserRole, type: 'access' },
        { expiresIn: '15m' }
      );

      const jti = generateJti();
      await storeRefreshToken(user.id, jti, 7 * 24 * 3600);

      const refreshToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role as UserRole, type: 'refresh', jti },
        { expiresIn: '7d' }
      );

      // Update last login
      await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

      // Resolve employeeId if not explicitly stored in user record
      let employeeId = user.employeeId;
      if (!employeeId) {
        const emp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, user.id)).limit(1);
        if (emp.length > 0) {
          employeeId = emp[0].id;
        }
      }

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            employeeId: employeeId || undefined,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Register
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = registerSchema.parse(request.body);
      
      // Check if email already exists
      const existingUser = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
      
      if (existingUser.length > 0) {
        return reply.status(409).send({ success: false, error: 'Email already exists' });
      }

      // Hash password (max 72 bytes safe for bcrypt)
      const passwordHash = await hash(body.password, 12);

      // Create user - forced to employee role
      const newUser = await db.insert(users).values({
        email: body.email,
        passwordHash,
        role: 'employee',
        employeeId: body.employeeId,
        isActive: true,
      }).returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: newUser[0].id,
          email: newUser[0].email,
          role: newUser[0].role,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      // Catch PostgreSQL unique constraint violation (code 23505)
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        return reply.status(409).send({ success: false, error: 'Email already exists' });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Refresh Token with Rotation & Anti-Replay
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { refreshToken } = (request.body as { refreshToken?: string }) || {};
      
      if (!refreshToken) {
        return reply.status(400).send({ success: false, error: 'Refresh token required' });
      }

      // Verify refresh token structure
      const decoded = app.jwt.verify(refreshToken) as {
        id: string;
        email: string;
        role: UserRole;
        type?: string;
        jti?: string;
      };
      
      if (decoded.type !== 'refresh' || !decoded.jti) {
        return reply.status(401).send({ success: false, error: 'Invalid token type' });
      }

      // Verify if token is still valid in store
      const isValid = await isRefreshTokenValid(decoded.id, decoded.jti);
      if (!isValid) {
        // Token was revoked or already used (possible token reuse attack)
        await revokeAllUserTokens(decoded.id);
        return reply.status(401).send({ success: false, error: 'Refresh token revoked or already used' });
      }

      // Revoke the old refresh token (rotate)
      await revokeRefreshToken(decoded.id, decoded.jti);

      // Find user
      const result = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);
      
      if (result.length === 0 || !result[0].isActive) {
        return reply.status(401).send({ success: false, error: 'User not found or inactive' });
      }

      const user = result[0];

      // Issue new access token
      const accessToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role as UserRole, type: 'access' },
        { expiresIn: '15m' }
      );

      // Issue new rotated refresh token
      const newJti = generateJti();
      await storeRefreshToken(user.id, newJti, 7 * 24 * 3600);

      const newRefreshToken = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role as UserRole, type: 'refresh', jti: newJti },
        { expiresIn: '7d' }
      );

      return reply.send({
        success: true,
        data: { accessToken, refreshToken: newRefreshToken },
      });
    } catch (error) {
      return reply.status(401).send({ success: false, error: 'Invalid refresh token' });
    }
  });

  // Get Current User
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      
      const result = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      
      if (result.length === 0) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const userData = result[0];
      let employeeId = userData.employeeId;
      if (!employeeId) {
        const emp = await db.select({ id: employees.id }).from(employees).where(eq(employees.userId, userData.id)).limit(1);
        if (emp.length > 0) {
          employeeId = emp[0].id;
        }
      }

      return reply.send({
        success: true,
        data: {
          id: userData.id,
          email: userData.email,
          role: userData.role,
          employeeId: employeeId || undefined,
          isActive: userData.isActive,
          lastLogin: userData.lastLogin,
          createdAt: userData.createdAt,
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Logout - Revoke user's refresh tokens
  app.post('/logout', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      await revokeAllUserTokens(user.id);
      return reply.send({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      app.log.error(error);
      return reply.send({ success: true, message: 'Logged out successfully' });
    }
  });

  // Admin-only (RBAC check)
  app.get('/admin-only', {
    preHandler: [app.authenticate, requireRole('super_admin', 'hr_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true, message: 'Admin access granted' });
  });

  // Change password (self-service)
  app.put('/password', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = changePasswordSchema.parse(request.body);

      const [found] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (!found) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const isValid = await compare(body.currentPassword, found.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ success: false, error: 'Password saat ini salah' });
      }

      const passwordHash = await hash(body.newPassword, 12);
      await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

      return reply.send({ success: true, message: 'Password berhasil diubah' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // List users (admin only)
  app.get('/users', {
    preHandler: [app.authenticate, requireRole('hr_admin', 'super_admin')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(users).orderBy(desc(users.createdAt));
      return reply.send({
        success: true,
        data: data.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        })),
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Create user (admin only)
  app.post('/users', {
    preHandler: [app.authenticate, requireRole('hr_admin', 'super_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createUserSchema.parse(request.body);

      const existingUser = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
      if (existingUser.length > 0) {
        return reply.status(409).send({ success: false, error: 'Email already exists' });
      }

      const passwordHash = await hash(body.password, 12);
      const [newUser] = await db.insert(users).values({
        email: body.email,
        passwordHash,
        role: body.role,
        isActive: true,
      }).returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        return reply.status(409).send({ success: false, error: 'Email already exists' });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Update user role (admin only; self-demotion blocked)
  app.put('/users/:id/role', {
    preHandler: [app.authenticate, requireRole('hr_admin', 'super_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateUserRoleSchema.parse(request.body);
      const actor = request.user;

      if (actor.id === id) {
        return reply.status(400).send({ success: false, error: 'Tidak dapat mengubah role akun sendiri' });
      }

      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const [updated] = await db.update(users).set({ role: body.role }).where(eq(users.id, id)).returning();
      await revokeAllUserTokens(id);

      return reply.send({
        success: true,
        data: { id: updated.id, email: updated.email, role: updated.role },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Delete user (super admin only; self-deletion blocked)
  app.delete('/users/:id', {
    preHandler: [app.authenticate, requireRole('super_admin')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const actor = request.user;

      if (actor.id === id) {
        return reply.status(400).send({ success: false, error: 'Tidak dapat menghapus akun sendiri' });
      }

      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      await revokeAllUserTokens(id);
      await db.delete(users).where(eq(users.id, id));

      return reply.send({ success: true, message: 'User deleted' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
