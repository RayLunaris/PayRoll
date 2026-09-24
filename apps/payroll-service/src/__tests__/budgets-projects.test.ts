import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, budgets, projects, projectMembers, projectExpenses, users, employees, eq } from '@payrollpro/db';
import { buildApp } from '../index.js';

process.env.JWT_SECRET ||= 'test-only-secret-not-used-in-production';

let app: FastifyInstance;
let adminToken = '';
let employeeToken = '';
const createdBudgetIds: string[] = [];
const createdProjectIds: string[] = [];

beforeAll(async () => {
  app = await buildApp();

  const [admin] = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);
  if (admin) {
    adminToken = app.jwt.sign({
      id: admin.id,
      email: admin.email,
      role: 'super_admin',
    });
  }

  const [emp] = await db.select().from(users).where(eq(users.role, 'employee')).limit(1);
  if (emp) {
    employeeToken = app.jwt.sign({
      id: emp.id,
      email: emp.email,
      role: 'employee',
    });
  } else if (admin) {
    employeeToken = app.jwt.sign({
      id: admin.id,
      email: 'mock-emp@payrollpro.com',
      role: 'employee',
    });
  }
});

afterAll(async () => {
  for (const id of createdProjectIds) {
    await db.delete(projectExpenses).where(eq(projectExpenses.projectId, id));
    await db.delete(projectMembers).where(eq(projectMembers.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  }
  for (const id of createdBudgetIds) {
    await db.delete(budgets).where(eq(budgets.id, id));
  }
  await app.close();
});

describe('Budget and Project Costing API', () => {
  it('should reject non-admin from creating budget (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budgets',
      headers: { authorization: `Bearer ${employeeToken}` },
      payload: {
        name: 'Unauthorized Budget',
        periodYear: 2026,
        category: 'payroll',
        allocatedAmount: 100000000,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should allow admin to create budget allocation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budgets',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Anggaran Payroll Q1 2026',
        periodYear: 2026,
        category: 'payroll',
        allocatedAmount: 500000000,
        notes: 'Pagu gaji rutin',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Anggaran Payroll Q1 2026');
    expect(body.data.allocatedAmount).toBe('500000000.00');

    createdBudgetIds.push(body.data.id);
  });

  it('should return executive budget summary on GET /api/budgets/summary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budgets/summary?year=2026',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('totalAllocated');
    expect(body.data).toHaveProperty('totalSpent');
    expect(body.data).toHaveProperty('remainingBudget');
    expect(body.data).toHaveProperty('statusColor');
  });

  it('should perform pre-check payroll overbudget guardrail on GET /api/budgets/check-payroll', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budgets/check-payroll?month=3&year=2026',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('hasBudget');
    expect(body.data).toHaveProperty('isOverbudget');
    expect(body.data).toHaveProperty('estimatedPayroll');
  });

  it('should allow admin to create project and query it', async () => {
    const code = `PRJ-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code,
        name: 'Implementasi HR Portal 2026',
        clientName: 'PT Klien Utama',
        totalBudget: 150000000,
        laborBudget: 100000000,
        operationalBudget: 50000000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'active',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.code).toBe(code);

    const projectId = body.data.id;
    createdProjectIds.push(projectId);

    // Record an operational expense
    const expRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/expenses`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        expenseTitle: 'Sewa Server Cloud AWS & Domain',
        category: 'cloud_server',
        amount: 5000000,
        expenseDate: '2026-03-01',
      },
    });

    expect(expRes.statusCode).toBe(201);
    expect(expRes.json().success).toBe(true);

    // Fetch project detail and verify calculations
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/projects/${projectId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(detailRes.statusCode).toBe(200);
    const detailBody = detailRes.json();
    expect(detailBody.success).toBe(true);
    expect(detailBody.data.spentOperational).toBe('5000000.00');
    expect(detailBody.data.totalSpent).toBe(5000000);
    expect(detailBody.data.remainingBudget).toBe(145000000);
    expect(detailBody.data.expenses.length).toBe(1);
  });
});
