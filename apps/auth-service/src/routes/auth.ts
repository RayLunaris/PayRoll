import crypto from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { hash, compare } from 'bcrypt';
import {
  db,
  users,
  employees,
  departments,
  positions,
  workLocations,
  passwordResetTokens,
  eq,
  or,
  desc,
  and,
  isNull,
  gt,
} from '@payrollpro/db';
import { UserRole } from '@payrollpro/shared-types';
import { requireRole } from '../middleware/auth.js';
import {
  generateJti,
  storeRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
  revokeAllUserTokens,
  isLoginLocked,
  recordFailedLogin,
  clearLoginLockout,
} from '../services/token-store.js';
import { signRefreshToken, verifyRefreshToken } from '../services/refresh-jwt.js';
import { sendResetPasswordEmail } from '../lib/mailer.js';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token wajib diisi'),
  newPassword: z.string().min(6, 'Password baru minimal 6 karakter').max(72),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

// Register schema strictly disallows choosing roles (all self-registrations become employee)
// Automatically provisions a linked employee profile for the new user
const registerSchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  email: z.string().email(),
  password: z.string().min(6).max(72),
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
        max: process.env.NODE_ENV === 'test' ? 100 : 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);

      // Per-account brute-force lockout (complements the IP rate limit).
      if (await isLoginLocked(body.email)) {
        return reply.status(429).send({
          success: false,
          error: 'Too many failed login attempts. Please try again in 15 minutes.',
        });
      }

      // Find user by email
      const result = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

      if (result.length === 0) {
        await recordFailedLogin(body.email);
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }

      const user = result[0];

      if (!user.isActive) {
        return reply.status(403).send({ success: false, error: 'Account is deactivated' });
      }

      // Verify password
      const isValid = await compare(body.password, user.passwordHash);

      if (!isValid) {
        await recordFailedLogin(body.email);
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }

      // Reset the counter on a successful login.
      await clearLoginLockout(body.email);

      // Resolve employee profile (employeeId and departmentId)
      let employeeId = user.employeeId;
      let departmentId: string | null = null;
      const emp = await db.select({ id: employees.id, departmentId: employees.departmentId })
        .from(employees)
        .where(user.employeeId ? or(eq(employees.id, user.employeeId), eq(employees.userId, user.id)) : eq(employees.userId, user.id))
        .limit(1);
      if (emp.length > 0) {
        employeeId = emp[0].id;
        departmentId = emp[0].departmentId;
      }

      // Generate tokens with jti for rotation tracking
      const accessToken = app.jwt.sign(
        {
          id: user.id,
          userId: user.id,
          email: user.email,
          role: user.role as UserRole,
          employeeId: employeeId || undefined,
          departmentId: departmentId || undefined,
          type: 'access',
        },
        { expiresIn: '15m' }
      );

      const jti = generateJti();
      await storeRefreshToken(user.id, jti, 7 * 24 * 3600);

      const refreshToken = signRefreshToken({
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        jti,
      });

      // Update last login
      await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            employeeId: employeeId || undefined,
            departmentId: departmentId || undefined,
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

      // Create user - forced to employee role.
      const newUser = await db.insert(users).values({
        email: body.email,
        passwordHash,
        role: 'employee',
        isActive: true,
      }).returning();

      // Automatically provision linked employee record with default department, position & location
      const [depts, pos, locs, allEmps] = await Promise.all([
        db.select().from(departments),
        db.select().from(positions),
        db.select().from(workLocations),
        db.select({ nip: employees.nip }).from(employees),
      ]);

      const defaultDept = depts.find(d => d.name.toLowerCase().includes('information') || d.name.toLowerCase().includes('it')) || depts[0];
      const defaultPos = pos[0];
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
      const rawName = body.fullName?.trim() || body.email.split('@')[0];
      const fullName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      const [newEmp] = await db.insert(employees).values({
        userId: newUser[0].id,
        nip,
        fullName,
        departmentId: defaultDept?.id,
        positionId: defaultPos?.id,
        locationId: defaultLoc?.id,
        joinDate: today,
        baseSalary: '8000000.00',
        isActive: true,
      }).returning();

      await db.update(users).set({ employeeId: newEmp.id }).where(eq(users.id, newUser[0].id));

      return reply.status(201).send({
        success: true,
        data: {
          id: newUser[0].id,
          email: newUser[0].email,
          role: newUser[0].role,
          employeeId: newEmp.id,
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

      // Verify refresh token structure (signed with JWT_REFRESH_SECRET, not access secret)
      let decoded: ReturnType<typeof verifyRefreshToken>;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch {
        return reply.status(401).send({ success: false, error: 'Invalid refresh token' });
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

      // Resolve employee profile (employeeId and departmentId)
      let employeeId = user.employeeId;
      let departmentId: string | null = null;
      const emp = await db.select({ id: employees.id, departmentId: employees.departmentId })
        .from(employees)
        .where(user.employeeId ? or(eq(employees.id, user.employeeId), eq(employees.userId, user.id)) : eq(employees.userId, user.id))
        .limit(1);
      if (emp.length > 0) {
        employeeId = emp[0].id;
        departmentId = emp[0].departmentId;
      }

      // Issue new access token
      const accessToken = app.jwt.sign(
        {
          id: user.id,
          userId: user.id,
          email: user.email,
          role: user.role as UserRole,
          employeeId: employeeId || undefined,
          departmentId: departmentId || undefined,
          type: 'access',
        },
        { expiresIn: '15m' }
      );

      // Issue new rotated refresh token
      const newJti = generateJti();
      await storeRefreshToken(user.id, newJti, 7 * 24 * 3600);

      const newRefreshToken = signRefreshToken({
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        jti: newJti,
      });

      return reply.send({
        success: true,
        data: { accessToken, refreshToken: newRefreshToken },
      });
    } catch (error) {
      return reply.status(401).send({ success: false, error: 'Invalid refresh token' });
    }
  });

  // Forgot Password — sends reset email via Gmail (Nodemailer) with secure SHA-256 token
  app.post('/forgot-password', {
    config: {
      rateLimit: {
        max: process.env.NODE_ENV === 'test' ? 100 : 3,
        timeWindow: '15 minutes',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = forgotPasswordSchema.parse(request.body);
      const email = body.email.toLowerCase().trim();

      // IMPORTANT: The response is identical whether email exists or not to prevent account enumeration
      const genericResponse = {
        success: true,
        message: 'Jika email terdaftar, link reset password sudah dikirim ke inbox Anda.',
      };

      const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (userResult.length === 0) {
        return reply.send(genericResponse);
      }

      const user = userResult[0];
      if (!user.isActive) {
        return reply.send(genericResponse);
      }

      // Generate random 32-byte token and hash it with SHA-256
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Invalidate any existing unused reset tokens for this user
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

      // Insert new token valid for 30 minutes
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      // Get user full name (from employees table if linked, fallback to email prefix)
      let employeeName = user.email.split('@')[0];
      const empResult = await db.select({ fullName: employees.fullName })
        .from(employees)
        .where(eq(employees.userId, user.id))
        .limit(1);
      if (empResult.length > 0 && empResult[0].fullName) {
        employeeName = empResult[0].fullName;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

      await sendResetPasswordEmail(user.email, resetLink, employeeName);

      return reply.send(genericResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Format email tidak valid', details: error.errors });
      }
      console.error('FORGOT-PASSWORD ERROR:', error);
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Reset Password — validates token, hashes new password with bcrypt, invalidates token and old sessions
  app.post('/reset-password', {
    config: {
      rateLimit: {
        max: process.env.NODE_ENV === 'test' ? 100 : 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = resetPasswordSchema.parse(request.body);
      const tokenHash = crypto.createHash('sha256').update(body.token).digest('hex');

      const records = await db.select().from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        ))
        .limit(1);

      if (records.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Token tidak valid atau sudah kedaluwarsa.',
          message: 'Token tidak valid atau sudah kedaluwarsa.',
        });
      }

      const resetRecord = records[0];

      // Hash new password using bcrypt (12 rounds)
      const passwordHash = await hash(body.newPassword, 12);

      // Update user password in database
      await db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, resetRecord.userId));

      // Mark token as used so it cannot be reused
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetRecord.id));

      // Revoke all refresh tokens for this user across all devices
      await revokeAllUserTokens(resetRecord.userId);

      // Clear any login lockout for this account
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, resetRecord.userId)).limit(1);
      if (user?.email) {
        await clearLoginLockout(user.email);
      }

      return reply.send({
        success: true,
        message: 'Password berhasil direset. Silakan login dengan password baru.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: error.errors[0]?.message || 'Validation error',
          details: error.errors,
        });
      }
      console.error('RESET-PASSWORD ERROR:', error);
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
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
      // Security: revoke all refresh tokens so every existing session is
      // forced out after a password change (including other devices).
      await revokeAllUserTokens(user.id);

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
      await db.delete(employees).where(eq(employees.userId, id));
      await db.delete(users).where(eq(users.id, id));

      return reply.send({ success: true, message: 'User deleted' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
