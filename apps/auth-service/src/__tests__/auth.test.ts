import crypto from 'crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, users, passwordResetTokens, eq } from '@payrollpro/db';
import { buildApp } from '../index.js';

process.env.JWT_SECRET ||= 'test-only-secret-not-used-in-production';
process.env.JWT_REFRESH_SECRET ||= 'test-only-refresh-secret-not-used-in-production';

const ADMIN_EMAIL = 'admin@payrollpro.com';
const ADMIN_PASSWORD = 'admin123';

let app: FastifyInstance;
let adminToken = '';
const cleanupUserIds: string[] = [];

beforeAll(async () => {
  app = await buildApp();

  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  adminToken = adminLogin.json().data?.accessToken || '';
  if (!adminToken) {
    throw new Error('Admin login failed — seed data missing?');
  }
});

afterAll(async () => {
  for (const id of cleanupUserIds) {
    await app.inject({
      method: 'DELETE',
      url: `/api/auth/users/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
  }
  await app.close();
});

describe('Auth API', () => {
  const suffix = Date.now().toString(36);
  const testUser = {
    email: `itest_${suffix}@payrollpro.com`,
    password: 'testpassword123',
    fullName: 'Test User',
    role: 'employee',
  };

  it('should reject invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: 'wrongpass1' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('should register a new user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: testUser.email, password: testUser.password },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.email).toBe(testUser.email);
    expect(body.data.role).toBe('employee');
    cleanupUserIds.push(body.data.id);
  });

  it('should reject duplicate registration', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: testUser.email, password: testUser.password },
    });
    expect(response.statusCode).toBe(409);
  });

  it('should login and return JWT tokens', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: testUser.password },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveProperty('accessToken');
    expect(body.data).toHaveProperty('refreshToken');
    expect(body.data.user.role).toBe('employee');
  });

  it('should get current user with valid token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: testUser.password },
    });
    const { accessToken } = login.json().data;

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.email).toBe(testUser.email);
  });

  it('should return 401 for /me without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(response.statusCode).toBe(401);
  });

  it('should reject employee from admin-only route', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: testUser.password },
    });
    const { accessToken } = login.json().data;

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('should allow admin to list users', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/users',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().data)).toBe(true);
  });

  it('should change own password and re-login with new one', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: testUser.password },
    });
    const token = login.json().data.accessToken;

    const change = await app.inject({
      method: 'PUT',
      url: '/api/auth/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: testUser.password, newPassword: 'newpass12345' },
    });
    expect(change.statusCode).toBe(200);

    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: testUser.password },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: 'newpass12345' },
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it('should reject wrong current password on change', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: 'newpass12345' },
    });
    const token = login.json().data.accessToken;

    const change = await app.inject({
      method: 'PUT',
      url: '/api/auth/password',
      headers: { authorization: `Bearer ${token}` },
      payload: { currentPassword: 'bukanpassword', newPassword: 'selalu12345' },
    });
    expect(change.statusCode).toBe(401);
  });

  it('should return generic response on forgot-password for non-existent and existing email', async () => {
    // Non-existent email
    const nonExistent = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'nobody_here@payrollpro.com' },
    });
    expect(nonExistent.statusCode).toBe(200);
    expect(nonExistent.json().message).toContain('Jika email terdaftar');

    // Existing email
    const existing = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: testUser.email },
    });
    expect(existing.statusCode).toBe(200);
    expect(existing.json().message).toContain('Jika email terdaftar');
  });

  it('should reject invalid email on forgot-password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should reject reset-password with invalid or non-existent token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: 'invalid_token_123', newPassword: 'brandNewPassword123' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Token tidak valid');
  });

  it('should successfully reset password with valid token and allow login with new password', async () => {
    // Create a known user and token directly in db to test reset
    const resetUserEmail = `reset_user_${Date.now()}@payrollpro.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: resetUserEmail,
        password: 'initialPassword123',
        fullName: 'Reset Tester',
      },
    });
    expect(regRes.statusCode).toBe(201);
    const userId = regRes.json().data.id;
    cleanupUserIds.push(userId);

    // Generate valid raw token & insert hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      userId,
      tokenHash,
      expiresAt,
    });

    // Reset password with the valid raw token
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        token: rawToken,
        newPassword: 'resetNewPassword456',
      },
    });
    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.json().message).toContain('berhasil direset');

    // Token should now be marked as used and cannot be reused
    const reuseRes = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        token: rawToken,
        newPassword: 'anotherPassword789',
      },
    });
    expect(reuseRes.statusCode).toBe(400);

    // Login with old password should fail
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: resetUserEmail, password: 'initialPassword123' },
    });
    expect(oldLogin.statusCode).toBe(401);

    // Login with new password should succeed
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: resetUserEmail, password: 'resetNewPassword456' },
    });
    expect(newLogin.statusCode).toBe(200);
    expect(newLogin.json().data?.accessToken).toBeDefined();
  });
});