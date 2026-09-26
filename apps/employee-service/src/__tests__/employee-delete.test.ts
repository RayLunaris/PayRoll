import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  db,
  employees,
  users,
  departments,
  positions,
  workLocations,
  leaveQuotas,
  payrolls,
  eq,
} from '@payrollpro/db';
import { buildApp } from '../index.js';

process.env.JWT_SECRET ||= 'test-only-secret-not-used-in-production';

let app: FastifyInstance;
let adminToken = '';
let testDeptId = '';
let testPosId = '';
let testLocId = '';

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

  const [dept] = await db.select().from(departments).limit(1);
  const [pos] = await db.select().from(positions).limit(1);
  const [loc] = await db.select().from(workLocations).limit(1);

  testDeptId = dept.id;
  testPosId = pos.id;
  testLocId = loc.id;
});

afterAll(async () => {
  await app.close();
});

describe('DELETE /api/employees/:id cascade & user deletion', () => {
  it('should delete employee, cascade leave quotas, and delete associated employee user', async () => {
    // 1. Create a dummy user
    const [testUser] = await db
      .insert(users)
      .values({
        email: `test-del-${Date.now()}@payrollpro.com`,
        passwordHash: 'dummy-hash',
        role: 'employee',
      })
      .returning();

    // 2. Create employee linked to user
    const [testEmp] = await db
      .insert(employees)
      .values({
        userId: testUser.id,
        nip: `TEST-DEL-${Date.now()}`,
        fullName: 'Test Delete Employee',
        departmentId: testDeptId,
        positionId: testPosId,
        locationId: testLocId,
        joinDate: '2025-01-01',
        baseSalary: '5000000.00',
        isActive: true,
      })
      .returning();

    await db.update(users).set({ employeeId: testEmp.id }).where(eq(users.id, testUser.id));

    // 3. Add leave quota (the exact thing that caused foreign key constraint violations!)
    await db.insert(leaveQuotas).values({
      employeeId: testEmp.id,
      leaveType: 'annual',
      year: 2026,
      totalQuota: 12,
      usedQuota: 0,
    });

    // 4. Call DELETE endpoint
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/employees/${testEmp.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    // 5. Verify employee is gone
    const empCheck = await db.select().from(employees).where(eq(employees.id, testEmp.id));
    expect(empCheck.length).toBe(0);

    // 6. Verify leave quotas are gone
    const quotaCheck = await db.select().from(leaveQuotas).where(eq(leaveQuotas.employeeId, testEmp.id));
    expect(quotaCheck.length).toBe(0);

    // 7. Verify associated user account is deleted
    const userCheck = await db.select().from(users).where(eq(users.id, testUser.id));
    expect(userCheck.length).toBe(0);
  });

  it('should block deletion if employee has payroll history', async () => {
    // 1. Create employee
    const [testEmp] = await db
      .insert(employees)
      .values({
        nip: `TEST-PAYROLL-${Date.now()}`,
        fullName: 'Test Payroll Employee',
        departmentId: testDeptId,
        positionId: testPosId,
        locationId: testLocId,
        joinDate: '2025-01-01',
        baseSalary: '5000000.00',
        isActive: true,
      })
      .returning();

    // 2. Add dummy payroll
    const [payroll] = await db
      .insert(payrolls)
      .values({
        employeeId: testEmp.id,
        periodMonth: 1,
        periodYear: 2026,
        baseSalary: '5000000.00',
        netSalary: '5000000.00',
        status: 'draft',
      })
      .returning();

    // 3. Try to delete
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/employees/${testEmp.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error).toContain('riwayat penggajian');

    // Clean up
    await db.delete(payrolls).where(eq(payrolls.id, payroll.id));
    await db.delete(employees).where(eq(employees.id, testEmp.id));
  });
});
