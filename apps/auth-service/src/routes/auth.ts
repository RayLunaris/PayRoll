import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { hash, compare } from 'bcrypt';
import { db, users, eq } from '@payrollpro/db';
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
        { id: user.id, email: user.email, role: user.role as UserRole },
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

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
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
        { id: user.id, email: user.email, role: user.role as UserRole },
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

      return reply.send({
        success: true,
        data: {
          id: userData.id,
          email: userData.email,
          role: userData.role,
          employeeId: userData.employeeId,
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
}
