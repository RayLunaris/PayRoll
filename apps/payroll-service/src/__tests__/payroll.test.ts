import { describe, expect, it, afterAll } from 'vitest';
import { db, employees, attendances, eq } from '@payrollpro/db';
import { calculateBPJS } from '../services/bpjs.js';
import { calculatePPh21 } from '../services/tax.js';
import { calculateOvertimePay } from '../services/overtime.js';

const fixtureNip = `ITEST-${Date.now().toString(36).toUpperCase()}`;
let fixtureEmployeeId = '';

afterAll(async () => {
  if (fixtureEmployeeId) {
    await db.delete(attendances).where(eq(attendances.employeeId, fixtureEmployeeId));
    await db.delete(employees).where(eq(employees.nip, fixtureNip));
  }
});

describe('calculateBPJS', () => {
  it('should compute employee and employer amounts from active config', async () => {
    const result = await calculateBPJS(5000000);

    const jkn = result.detail.find((d) => d.component === 'BPJS_KES');
    expect(jkn?.employeeAmount).toBe(50000);
    expect(jkn?.employerAmount).toBe(200000);

    const jht = result.detail.find((d) => d.component === 'JHT');
    expect(jht?.employeeAmount).toBe(100000);
    expect(jht?.employerAmount).toBe(185000);

    expect(result.totalEmployee).toBe(250000);
    expect(result.totalEmployer).toBe(597000);
  });

  it('should apply max salary cap for JP component', async () => {
    const result = await calculateBPJS(15000000);

    const jp = result.detail.find((d) => d.component === 'JP');
    // Cap at Rp 12.000.000 -> 12jt * 2% = 240.000 (uncapped would be 300.000)
    expect(jp?.employeeAmount).toBe(240000);
  });
});

describe('calculatePPh21', () => {
  it('should apply PTKP and progressive brackets', async () => {
    const result = await calculatePPh21(10000000, 0, 'TK/0', true);

    // annual gross 120jt, biaya jabatan 6jt, pensiun 4.8jt
    expect(result.annualNetIncome).toBe(109200000);
    // net 109.2jt - PTKP 54jt = 55.2jt taxable, all within 5% bracket
    expect(result.annualTaxableIncome).toBe(55200000);
    expect(result.annualTax).toBe(2760000);
    expect(result.monthlyTax).toBe(230000);
  });

  it('should return zero tax when annual income below PTKP', async () => {
    const result = await calculatePPh21(3000000);
    expect(result.annualTax).toBe(0);
    expect(result.monthlyTax).toBe(0);
  });
});

describe('calculateOvertimePay', () => {
  it('should compute weekday overtime: 1st hour 1.5x, subsequent 2.0x', async () => {
    // Create employee + a weekday attendance with 2 overtime hours
    const [emp] = await db
      .insert(employees)
      .values({
        nip: fixtureNip,
        fullName: 'Integration Test Employee',
        joinDate: '2025-01-01',
        baseSalary: '5000000',
      })
      .returning();
    fixtureEmployeeId = emp.id;

    // 2026-09-18 is a Friday (weekday, not weekend/holiday)
    await db.insert(attendances).values({
      employeeId: emp.id,
      date: '2026-09-18',
      status: 'present',
      overtimeHours: '2',
    });

    const result = await calculateOvertimePay(emp.id, '2026-09-01', '2026-09-30', 5000000);

    // hourly rate = 5.000.000 / 173 = 28.901,73
    // first hour 1.5x + second hour 2.0x = (1*1.5 + 1*2) * hourlyRate
    expect(result.totalHours).toBe(2);
    expect(result.overtimePay).toBe(101156);
    expect(result.detail).toHaveLength(1);
    expect(result.detail[0].date).toBe('2026-09-18');
  });
});