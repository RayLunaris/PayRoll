import {
  db,
  employees,
  positions,
  payrolls,
  cashAdvances,
  projectMembers,
  projects,
  budgets,
  eq,
  and,
  or,
  inArray,
  sql,
} from '@payrollpro/db';
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

export interface ProcessEmployeePayrollOptions {
  preloadedEmployee?: typeof employees.$inferSelect;
  preloadedPositions?: Map<string, typeof positions.$inferSelect>;
  preloadedCashAdvances?: typeof cashAdvances.$inferSelect[];
}

/**
 * Returns the amount that must be applied to the payroll budget when a
 * payroll record is created or recalculated.
 */
export function calculateBudgetSpendDelta(
  previousNetSalary: string | number | null | undefined,
  currentNetSalary: number,
): number {
  return Math.round((currentNetSalary - parseFloat(String(previousNetSalary || '0'))) * 100) / 100;
}

// Process payroll for a single employee with transactional consistency and period lock
export async function processEmployeePayroll(
  employeeId: string,
  month: number,
  year: number,
  options?: ProcessEmployeePayrollOptions
): Promise<PayrollResult> {
  // Get employee
  let emp = options?.preloadedEmployee;
  if (!emp) {
    const employee = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
    if (employee.length === 0) {
      throw new Error('Employee not found');
    }
    emp = employee[0];
  }

  // Base salary resolution (from employee or position fallback)
  let baseSalary = parseFloat(emp.baseSalary || '0');
  let positionAllowance = 0;
  if (emp.positionId) {
    let position = options?.preloadedPositions?.get(emp.positionId);
    if (!position) {
      const posRes = await db.select().from(positions).where(eq(positions.id, emp.positionId)).limit(1);
      if (posRes.length > 0) position = posRes[0];
    }
    if (position) {
      if (baseSalary <= 0 && position.baseSalary) {
        baseSalary = parseFloat(position.baseSalary);
      }
      if (position.positionAllowance) {
        positionAllowance = parseFloat(position.positionAllowance);
      }
    }
  }

  if (baseSalary <= 0) {
    // Never silently pay the minimum-wage fallback: wrong money amount.
    // Fail loudly so the missing base salary is configured properly.
    throw new Error(`Employee ${employeeId} has no base salary configured (employee or position record)`);
  }

  // Dynamic end date
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

  // Overtime pay with tiered calculation
  const overtime = await calculateOvertimePay(employeeId, startDate, endDate, baseSalary);

  // Allowances (5% fixed transport/meal allowance + position allowance)
  const allowances = Math.round(baseSalary * 0.05) + positionAllowance;

  const grossSalary = baseSalary + overtime.overtimePay + allowances;

  // BPJS (statutory calculation base: Gaji Pokok + Tunjangan Tetap, excluding overtime)
  const bpjsBase = baseSalary + allowances;
  const bpjs = await calculateBPJS(bpjsBase);

  // PPh 21 (takes into account NPWP existence + PTKP marital status & dependents)
  const maritalPart = (emp.maritalStatus?.split('/')[0] || 'TK').toUpperCase() === 'K' ? 'K' : 'TK';
  const dependents = Math.min(Math.max(emp.dependents || 0, 0), 3);
  const ptkpStatus = `${maritalPart}/${dependents}`;
  const tax = await calculatePPh21(grossSalary, 0, ptkpStatus, Boolean(emp.npwp));

  // Cash advances approved or previously deducted for this period (safe on re-processing)
  const advances = options?.preloadedCashAdvances !== undefined
    ? options.preloadedCashAdvances
    : await db.select().from(cashAdvances)
        .where(and(
          eq(cashAdvances.employeeId, employeeId),
          eq(cashAdvances.month, month),
          eq(cashAdvances.year, year),
          or(eq(cashAdvances.status, 'approved'), eq(cashAdvances.status, 'deducted'))
        ));

  const totalCashAdvance = advances.reduce((sum, a) => sum + parseFloat(a.amount || '0'), 0);

  // Calculate Net Salary (never negative)
  const otherDeductions = 0;
  const netSalary = Math.max(
    0,
    Math.round(
      baseSalary +
      overtime.overtimePay +
      allowances -
      bpjs.totalEmployee -
      tax.monthlyTax -
      totalCashAdvance -
      otherDeductions
    )
  );

  // Period lock: the "already paid" check and the upsert run INSIDE the same
  // transaction under a FOR UPDATE row lock. Checking outside the transaction
  // was a TOCTOU: two concurrent runs for the same period both passed the
  // check and both wrote, and a paid run could race a processed rerun.
  let payrollId: string;

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(payrolls)
      .where(and(
        eq(payrolls.employeeId, employeeId),
        eq(payrolls.periodMonth, month),
        eq(payrolls.periodYear, year)
      ))
      .for('update')
      .limit(1);

    if (existing.length > 0 && existing[0].status === 'paid') {
      throw new Error(`Payroll for period ${month}/${year} has already been marked as paid and cannot be reprocessed`);
    }

    if (existing.length > 0) {
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
        .where(eq(payrolls.id, existing[0].id))
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

      // Allocate labor cost to projects if employee is assigned
      const activeMemberships = await tx
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.employeeId, employeeId));

      for (const m of activeMemberships) {
        const cost = parseFloat(m.assignedMonthlyCost || '0');
        if (cost > 0) {
          const [proj] = await tx.select().from(projects).where(eq(projects.id, m.projectId)).limit(1);
          if (proj) {
            const currentLabor = parseFloat(proj.spentLabor || '0');
            await tx
              .update(projects)
              .set({ spentLabor: (currentLabor + cost).toFixed(2), updatedAt: new Date() })
              .where(eq(projects.id, proj.id));
          }
        }
      }

    }

    // Update the applicable payroll budget by the net change, not by the full
    // payroll amount. This keeps re-processing idempotent and lets a corrected
    // payroll reduce the realization instead of leaving stale spending behind.
    // A month-specific allocation takes precedence over an annual allocation.
    const activeBudgets = await tx
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.periodYear, year),
          eq(budgets.category, 'payroll'),
          eq(budgets.status, 'active'),
          sql`(${budgets.periodMonth} is null or ${budgets.periodMonth} = ${month})`,
        ),
      )
      .orderBy(sql`case when ${budgets.periodMonth} = ${month} then 0 else 1 end`, sql`${budgets.createdAt} asc`)
      .for('update');

    if (activeBudgets.length > 0) {
      const previousNetSalary = existing.length > 0 ? existing[0].netSalary : '0';
      const spendDelta = calculateBudgetSpendDelta(previousNetSalary, netSalary);

      if (spendDelta !== 0) {
        await tx
          .update(budgets)
          .set({
            spentAmount: sql`greatest(0, ${budgets.spentAmount} + ${spendDelta.toFixed(2)})`,
            updatedAt: new Date(),
          })
          .where(eq(budgets.id, activeBudgets[0].id));
      }
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

// Process payroll for all active employees (optionally restricted to a subset,
// e.g. a manager's own department)
export async function processAllPayrolls(month: number, year: number, employeeIds?: string[]): Promise<PayrollResult[]> {
  const allEmployees = employeeIds && employeeIds.length > 0
    ? await db.select().from(employees).where(and(eq(employees.isActive, true), inArray(employees.id, employeeIds)))
    : await db.select().from(employees).where(eq(employees.isActive, true));

  if (allEmployees.length === 0) {
    return [];
  }

  // 1. Batch pre-fetch all positions referenced by active employees
  const positionIds = Array.from(new Set(allEmployees.map((e) => e.positionId).filter(Boolean))) as string[];
  const positionMap = new Map<string, typeof positions.$inferSelect>();
  if (positionIds.length > 0) {
    const posList = await db.select().from(positions).where(inArray(positions.id, positionIds));
    for (const p of posList) {
      positionMap.set(p.id, p);
    }
  }

  // 2. Batch pre-fetch all cash advances for these employees in this period
  const activeEmpIds = allEmployees.map((e) => e.id);
  const advances = await db.select().from(cashAdvances)
    .where(and(
      inArray(cashAdvances.employeeId, activeEmpIds),
      eq(cashAdvances.month, month),
      eq(cashAdvances.year, year),
      or(eq(cashAdvances.status, 'approved'), eq(cashAdvances.status, 'deducted'))
    ));
  const advanceMap = new Map<string, typeof cashAdvances.$inferSelect[]>();
  for (const a of advances) {
    if (!a.employeeId) continue;
    if (!advanceMap.has(a.employeeId)) advanceMap.set(a.employeeId, []);
    advanceMap.get(a.employeeId)!.push(a);
  }

  const results: PayrollResult[] = [];

  for (const emp of allEmployees) {
    try {
      const result = await processEmployeePayroll(emp.id, month, year, {
        preloadedEmployee: emp,
        preloadedPositions: positionMap,
        preloadedCashAdvances: advanceMap.get(emp.id) || [],
      });
      results.push(result);
    } catch (error) {
      console.error(`Failed to process payroll for employee ${emp.id}:`, error);
    }
  }

  return results;
}
