import { db, employees, positions, payrolls, cashAdvances, eq, and, or } from '@payrollpro/db';
import { calculateBPJS } from './bpjs.js';
import { calculatePPh21 } from './tax.js';
import { calculateOvertimePay } from './overtime.js';

export interface PayrollResult {
  payrollId: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  netSalary: number;
  breakdown: {
    baseSalary: number;
    overtimePay: number;
    allowances: number;
    bpjsEmployee: number;
    bpjsEmployer: number;
    taxDeduction: number;
    cashAdvance: number;
    otherDeductions: number;
  };
}

// Process payroll for a single employee with transactional consistency and period lock
export async function processEmployeePayroll(
  employeeId: string,
  month: number,
  year: number
): Promise<PayrollResult> {
  // Get employee
  const employee = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (employee.length === 0) {
    throw new Error('Employee not found');
  }

  const emp = employee[0];

  // Base salary resolution (from employee or position fallback)
  let baseSalary = parseFloat(emp.baseSalary || '0');
  if (baseSalary <= 0 && emp.positionId) {
    const position = await db.select().from(positions).where(eq(positions.id, emp.positionId)).limit(1);
    if (position.length > 0 && position[0].baseSalary) {
      baseSalary = parseFloat(position[0].baseSalary);
    }
  }

  if (baseSalary <= 0) {
    baseSalary = 5000000; // Sensible minimum wage fallback
  }

  // Dynamic end date
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

  // Overtime pay with tiered calculation
  const overtime = await calculateOvertimePay(employeeId, startDate, endDate, baseSalary);

  // Allowances (5% fixed transport/meal allowance)
  const allowances = Math.round(baseSalary * 0.05);

  const grossSalary = baseSalary + overtime.overtimePay + allowances;

  // BPJS & PPh 21 (takes into account NPWP existence + PTKP marital status & dependents)
  const bpjs = await calculateBPJS(grossSalary);
  const maritalPart = (emp.maritalStatus?.split('/')[0] || 'TK').toUpperCase() === 'K' ? 'K' : 'TK';
  const dependents = Math.min(Math.max(emp.dependents || 0, 0), 3);
  const ptkpStatus = `${maritalPart}/${dependents}`;
  const tax = await calculatePPh21(grossSalary, 0, ptkpStatus, Boolean(emp.npwp));

  // Cash advances approved or previously deducted for this period (safe on re-processing)
  const advances = await db.select().from(cashAdvances)
    .where(and(
      eq(cashAdvances.employeeId, employeeId),
      eq(cashAdvances.month, month),
      eq(cashAdvances.year, year),
      or(eq(cashAdvances.status, 'approved'), eq(cashAdvances.status, 'deducted'))
    ));

  const totalCashAdvance = advances.reduce((sum, a) => sum + parseFloat(a.amount || '0'), 0);

  // Calculate Net Salary
  const otherDeductions = 0;
  const netSalary = Math.round(
    baseSalary +
    overtime.overtimePay +
    allowances -
    bpjs.totalEmployee -
    tax.monthlyTax -
    totalCashAdvance -
    otherDeductions
  );

  // Check if payroll already exists for this period
  const existingPayroll = await db.select().from(payrolls)
    .where(and(
      eq(payrolls.employeeId, employeeId),
      eq(payrolls.periodMonth, month),
      eq(payrolls.periodYear, year)
    ))
    .limit(1);

  // Period Lock: Cannot reprocess if already paid
  if (existingPayroll.length > 0 && existingPayroll[0].status === 'paid') {
    throw new Error(`Payroll for period ${month}/${year} has already been marked as paid and cannot be reprocessed`);
  }

  let payrollId: string;

  // Database transaction for payroll and cash advance updates
  await db.transaction(async (tx) => {
    if (existingPayroll.length > 0) {
      const updated = await tx.update(payrolls)
        .set({
          baseSalary: baseSalary.toFixed(2),
          overtimePay: overtime.overtimePay.toFixed(2),
          allowances: allowances.toFixed(2),
          bpjsEmployee: bpjs.totalEmployee.toFixed(2),
          bpjsEmployer: bpjs.totalEmployer.toFixed(2),
          taxDeduction: tax.monthlyTax.toFixed(2),
          cashAdvance: totalCashAdvance.toFixed(2),
          otherDeductions: otherDeductions.toFixed(2),
          netSalary: netSalary.toFixed(2),
          status: 'processed',
          updatedAt: new Date(),
        })
        .where(eq(payrolls.id, existingPayroll[0].id))
        .returning();
      payrollId = updated[0].id;
    } else {
      const created = await tx.insert(payrolls).values({
        employeeId,
        periodMonth: month,
        periodYear: year,
        baseSalary: baseSalary.toFixed(2),
        overtimePay: overtime.overtimePay.toFixed(2),
        allowances: allowances.toFixed(2),
        bpjsEmployee: bpjs.totalEmployee.toFixed(2),
        bpjsEmployer: bpjs.totalEmployer.toFixed(2),
        taxDeduction: tax.monthlyTax.toFixed(2),
        cashAdvance: totalCashAdvance.toFixed(2),
        otherDeductions: otherDeductions.toFixed(2),
        netSalary: netSalary.toFixed(2),
        status: 'processed',
      }).returning();
      payrollId = created[0].id;
    }

    // Mark approved cash advances as deducted
    for (const advance of advances) {
      if (advance.status !== 'deducted') {
        await tx.update(cashAdvances)
          .set({ status: 'deducted' })
          .where(eq(cashAdvances.id, advance.id));
      }
    }
  });

  return {
    payrollId: payrollId!,
    employeeId,
    periodMonth: month,
    periodYear: year,
    netSalary,
    breakdown: {
      baseSalary,
      overtimePay: overtime.overtimePay,
      allowances,
      bpjsEmployee: bpjs.totalEmployee,
      bpjsEmployer: bpjs.totalEmployer,
      taxDeduction: tax.monthlyTax,
      cashAdvance: totalCashAdvance,
      otherDeductions,
    },
  };
}

// Process payroll for all active employees
export async function processAllPayrolls(month: number, year: number): Promise<PayrollResult[]> {
  const allEmployees = await db.select().from(employees).where(eq(employees.isActive, true));
  const results: PayrollResult[] = [];

  for (const emp of allEmployees) {
    try {
      const result = await processEmployeePayroll(emp.id, month, year);
      results.push(result);
    } catch (error) {
      console.error(`Failed to process payroll for employee ${emp.id}:`, error);
    }
  }

  return results;
}
