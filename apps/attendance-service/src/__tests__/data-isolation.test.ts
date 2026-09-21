import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db, users, employees, overtimeRequests, departments, eq, inArray } from '@payrollpro/db';

process.env.JWT_SECRET ||= 'bd35276cdec8afcc4d3bf60352cf7f72664b89e774f1489b67d183a4ecdaed62';

let app: FastifyInstance;

// Fixtures IDs
const deptHRId = 'db1d2b9f-b4c3-4fa2-84f8-75d50230efc4';
const deptITId = '69ae3f92-bc43-488a-a1b1-effdc0f3295d';

// Test users
let userA: { id: string; email: string; role: string; employeeId: string };
let userB: { id: string; email: string; role: string; employeeId: string };
let managerHR: { id: string; email: string; role: string; employeeId: string };
let managerNoDept: { id: string; email: string; role: string; employeeId: string };

let tokenA = '';
let tokenB = '';
let tokenManagerHR = '';
let tokenManagerNoDept = '';

const cleanupUserIds: string[] = [];
const cleanupEmployeeIds: string[] = [];
const cleanupOvertimeIds: string[] = [];

beforeAll(async () => {
  app = await buildApp();

  const suffix = Date.now().toString(36);

  // 1. Create User A (Employee in IT)
  const [createdUserA] = await db.insert(users).values({
    email: `usera_${suffix}@test.com`,
    passwordHash: 'dummyhash',
    role: 'employee',
    isActive: true,
  }).returning();
  cleanupUserIds.push(createdUserA.id);

  const [createdEmpA] = await db.insert(employees).values({
    userId: createdUserA.id,
    nip: `EMP-A-${suffix}`,
    fullName: `User A (${suffix})`,
    departmentId: deptITId,
    joinDate: '2026-01-01',
    baseSalary: '5000000',
  }).returning();
  cleanupEmployeeIds.push(createdEmpA.id);
  userA = { id: createdUserA.id, email: createdUserA.email, role: 'employee', employeeId: createdEmpA.id };

  // 2. Create User B (Employee in HR)
  const [createdUserB] = await db.insert(users).values({
    email: `userb_${suffix}@test.com`,
    passwordHash: 'dummyhash',
    role: 'employee',
    isActive: true,
  }).returning();
  cleanupUserIds.push(createdUserB.id);

  const [createdEmpB] = await db.insert(employees).values({
    userId: createdUserB.id,
    nip: `EMP-B-${suffix}`,
    fullName: `User B (${suffix})`,
    departmentId: deptHRId,
    joinDate: '2026-01-01',
    baseSalary: '5000000',
  }).returning();
  cleanupEmployeeIds.push(createdEmpB.id);
  userB = { id: createdUserB.id, email: createdUserB.email, role: 'employee', employeeId: createdEmpB.id };

  // 3. Create Manager HR (Manager in HR)
  const [createdUserMgrHR] = await db.insert(users).values({
    email: `mgr_hr_${suffix}@test.com`,
    passwordHash: 'dummyhash',
    role: 'manager',
    isActive: true,
  }).returning();
  cleanupUserIds.push(createdUserMgrHR.id);

  const [createdEmpMgrHR] = await db.insert(employees).values({
    userId: createdUserMgrHR.id,
    nip: `MGR-HR-${suffix}`,
    fullName: `Manager HR (${suffix})`,
    departmentId: deptHRId,
    joinDate: '2026-01-01',
    baseSalary: '10000000',
  }).returning();
  cleanupEmployeeIds.push(createdEmpMgrHR.id);
  managerHR = { id: createdUserMgrHR.id, email: createdUserMgrHR.email, role: 'manager', employeeId: createdEmpMgrHR.id };

  // 4. Create Manager with NULL department
  const [createdUserMgrNoDept] = await db.insert(users).values({
    email: `mgr_nodept_${suffix}@test.com`,
    passwordHash: 'dummyhash',
    role: 'manager',
    isActive: true,
  }).returning();
  cleanupUserIds.push(createdUserMgrNoDept.id);

  const [createdEmpMgrNoDept] = await db.insert(employees).values({
    userId: createdUserMgrNoDept.id,
    nip: `MGR-ND-${suffix}`,
    fullName: `Manager No Dept (${suffix})`,
    departmentId: null,
    joinDate: '2026-01-01',
    baseSalary: '10000000',
  }).returning();
  cleanupEmployeeIds.push(createdEmpMgrNoDept.id);
  managerNoDept = { id: createdUserMgrNoDept.id, email: createdUserMgrNoDept.email, role: 'manager', employeeId: createdEmpMgrNoDept.id };

  // Sign JWT tokens
  tokenA = app.jwt.sign({ id: userA.id, email: userA.email, role: userA.role as any });
  tokenB = app.jwt.sign({ id: userB.id, email: userB.email, role: userB.role as any });
  tokenManagerHR = app.jwt.sign({ id: managerHR.id, email: managerHR.email, role: managerHR.role as any });
  tokenManagerNoDept = app.jwt.sign({ id: managerNoDept.id, email: managerNoDept.email, role: managerNoDept.role as any });
});

afterAll(async () => {
  if (cleanupOvertimeIds.length > 0) {
    await db.delete(overtimeRequests).where(inArray(overtimeRequests.id, cleanupOvertimeIds));
  }
  if (cleanupEmployeeIds.length > 0) {
    await db.delete(employees).where(inArray(employees.id, cleanupEmployeeIds));
  }
  if (cleanupUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, cleanupUserIds));
  }
  await app.close();
});

describe('Data Isolation and Access Control Security Tests', () => {
  let userAOvertimeId = '';
  let managerHROvertimeId = '';

  it('User A creates personal overtime request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/attendance/overtime-requests',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        date: '2026-09-22',
        hours: 2,
        reason: 'IT Project deployment User A',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.employeeId).toBe(userA.employeeId);
    userAOvertimeId = body.data.id;
    cleanupOvertimeIds.push(userAOvertimeId);
  });

  it('1. Personal Data Isolation: User B calls personal endpoint and NEVER sees User A data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/overtime-requests',
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    // User B must have 0 requests, or at least none belonging to User A
    const containsUserA = body.data.some((req: any) => req.id === userAOvertimeId || req.employeeId === userA.employeeId);
    expect(containsUserA).toBe(false);
  });

  it('2. Query Parameter Tampering: Employee calling ?all=true is rejected with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/attendance/overtime-requests?all=true',
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Forbidden');
  });

  it('3. Query Parameter Tampering: Employee calling ?employeeId=... is rejected with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/attendance/overtime-requests?employeeId=${userB.employeeId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Forbidden');
  });

  it('4. Query Parameter Tampering: Employee calling GET /history with ?employeeId=... is rejected with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/attendance/history?employeeId=${userB.employeeId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Forbidden');
  });

  it('5. Query Parameter Tampering: Employee calling GET /today with ?employeeId=... is rejected with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/attendance/today?employeeId=${userB.employeeId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Forbidden');
  });

  it('6. Direct IDOR: User B (employee) cannot approve User A overtime request', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/attendance/overtime-requests/${userAOvertimeId}/approve`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { approved: true },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  it('7. Department Boundary: Manager HR cannot approve User A (IT Department) overtime request', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/attendance/overtime-requests/${userAOvertimeId}/approve`,
      headers: { authorization: `Bearer ${tokenManagerHR}` },
      payload: { approved: true },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Hanya bisa approve lembur karyawan di departemen Anda');
  });

  it('8. Null-Safe Department: Manager with null departmentId cannot approve overtime request', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/attendance/overtime-requests/${userAOvertimeId}/approve`,
      headers: { authorization: `Bearer ${tokenManagerNoDept}` },
      payload: { approved: true },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
  });

  it('9. Anti-Self-Approval: Manager cannot approve their own overtime request', async () => {
    // Manager HR creates their own overtime request
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/attendance/overtime-requests',
      headers: { authorization: `Bearer ${tokenManagerHR}` },
      payload: {
        date: '2026-09-22',
        hours: 1,
        reason: 'HR Manager Overtime Request',
      },
    });

    expect(createRes.statusCode).toBe(201);
    managerHROvertimeId = createRes.json().data.id;
    cleanupOvertimeIds.push(managerHROvertimeId);

    // Manager HR attempts to approve their own overtime request
    const approveRes = await app.inject({
      method: 'PUT',
      url: `/api/attendance/overtime-requests/${managerHROvertimeId}/approve`,
      headers: { authorization: `Bearer ${tokenManagerHR}` },
      payload: { approved: true },
    });

    expect(approveRes.statusCode).toBe(400);
    const body = approveRes.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Tidak dapat menyetujui pengajuan lembur milik sendiri');
  });
});
