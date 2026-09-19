import { db, bpjsConfig, eq } from '@payrollpro/db';

export interface BpjsCalculation {
  component: string;
  employeeAmount: number;
  employerAmount: number;
}

export async function calculateBPJS(grossSalary: number): Promise<{
  detail: BpjsCalculation[];
  totalEmployee: number;
  totalEmployer: number;
}> {
  const configs = await db.select().from(bpjsConfig).where(eq(bpjsConfig.isActive, true));

  const detail: BpjsCalculation[] = [];
  let totalEmployee = 0;
  let totalEmployer = 0;

  for (const config of configs) {
    // Apply max salary cap if exists
    const salaryBase = config.maxSalaryCap ? Math.min(grossSalary, parseFloat(config.maxSalaryCap)) : grossSalary;

    // Round each component; totals are the SUM of the rounded values so the
    // breakdown lines and the grand total always reconcile exactly.
    const employeeAmount = Math.round(salaryBase * (parseFloat(config.employeeRate) / 100));
    const employerAmount = Math.round(salaryBase * (parseFloat(config.employerRate) / 100));

    totalEmployee += employeeAmount;
    totalEmployer += employerAmount;

    detail.push({
      component: config.component,
      employeeAmount,
      employerAmount,
    });
  }

  return {
    detail,
    totalEmployee,
    totalEmployer,
  };
}
