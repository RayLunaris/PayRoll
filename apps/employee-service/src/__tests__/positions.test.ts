import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, positions, positionSalaryAuditLogs, users, eq } from '@payrollpro/db';
import { buildApp } from '../index.js';

process.env.JWT_SECRET ||= 'test-only-secret-not-used-in-production';

let app: FastifyInstance;
let adminToken = '';
let employeeToken = '';
const createdPositionIds: string[] = [];

beforeAll(async () => {
  app = await buildApp();

  // Find or use admin user from DB
  const [admin] = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);
  if (admin) {
    adminToken = app.jwt.sign({
      id: admin.id,
      email: admin.email,
      role: 'super_admin',
    });
  }

  // Find or create employee user for test
  const [emp] = await db.select().from(users).where(eq(users.role, 'employee')).limit(1);
  if (emp) {
    employeeToken = app.jwt.sign({
      id: emp.id,
      email: emp.email,
      role: 'employee',
    });
  } else if (admin) {
    // Fallback if no employee user in DB: sign with employee role
    employeeToken = app.jwt.sign({
      id: admin.id,
      email: 'mock-emp@payrollpro.com',
      role: 'employee',
    });
  }
});

afterAll(async () => {
  for (const id of createdPositionIds) {
    await db.delete(positionSalaryAuditLogs).where(eq(positionSalaryAuditLogs.positionId, id));
    await db.delete(positions).where(eq(positions.id, id));
  }
  await app.close();
});

describe('Position RBAC and Salary Protection API', () => {
  it('should mask salary fields for non-admin users on GET /api/positions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/positions',
      headers: { authorization: `Bearer ${employeeToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    if (body.data.length > 0) {
      const first = body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).not.toHaveProperty('baseSalary');
      expect(first).not.toHaveProperty('minSalary');
      expect(first).not.toHaveProperty('maxSalary');
      expect(first).not.toHaveProperty('positionAllowance');
    }
  });

  it('should reveal full salary fields for admin users on GET /api/positions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/positions',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    if (body.data.length > 0) {
      const first = body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('baseSalary');
    }
  });

  it('should reject non-admin from creating position (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: {
        name: 'Unauthorized Role Test',
        baseSalary: 10000000,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should allow admin to create position with salary tier and allowance', async () => {
    const uniqueCode = `TST-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Software Architect Test',
        code: uniqueCode,
        grade: 'Grade 4',
        levelRank: 4,
        baseSalary: 25000000,
        minSalary: 20000000,
        maxSalary: 30000000,
        positionAllowance: 3500000,
        description: 'Lead technical architect',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.code).toBe(uniqueCode);
    expect(body.data.baseSalary).toBe('25000000.00');
    expect(body.data.positionAllowance).toBe('3500000.00');

    createdPositionIds.push(body.data.id);
  });

  it('should require reason when updating salary nominal and record in audit log', async () => {
    const testPosId = createdPositionIds[0];
    expect(testPosId).toBeDefined();

    // Attempt update salary without reason -> 400 Bad Request
    const noReasonRes = await app.inject({
      method: 'PUT',
      url: `/api/positions/${testPosId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        baseSalary: 28000000,
      },
    });
    expect(noReasonRes.statusCode).toBe(400);

    // Update with valid reason
    const successRes = await app.inject({
      method: 'PUT',
      url: `/api/positions/${testPosId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        baseSalary: 28000000,
        positionAllowance: 4000000,
        reason: 'Penyesuaian standar pasar tahun 2026',
      },
    });

    expect(successRes.statusCode).toBe(200);
    const body = successRes.json();
    expect(body.data.baseSalary).toBe('28000000.00');
    expect(body.data.positionAllowance).toBe('4000000.00');

    // Verify audit logs endpoint
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/positions/${testPosId}/audit-logs`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(auditRes.statusCode).toBe(200);
    const auditBody = auditRes.json();
    expect(auditBody.success).toBe(true);
    expect(auditBody.data.length).toBeGreaterThan(0);
    expect(auditBody.data[0].reason).toBe('Penyesuaian standar pasar tahun 2026');
    expect(auditBody.data[0].newBaseSalary).toBe('28000000.00');
  });

  it('should allow admin to delete unlinked position', async () => {
    // Create temporary position to delete
    const tempRes = await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Temporary Test Position',
        baseSalary: 5000000,
      },
    });
    const tempId = tempRes.json().data.id;

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/positions/${tempId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().success).toBe(true);
  });
});
