import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
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
});