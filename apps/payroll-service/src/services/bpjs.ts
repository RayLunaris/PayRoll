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

    const employeeAmount = salaryBase * (parseFloat(config.employeeRate) / 100);
    const employerAmount = salaryBase * (parseFloat(config.employerRate) / 100);

    totalEmployee += employeeAmount;
    totalEmployer += employerAmount;

    detail.push({
      component: config.component,
      employeeAmount: Math.round(employeeAmount),
      employerAmount: Math.round(employerAmount),
    });
  }

  return {
    detail,
    totalEmployee: Math.round(totalEmployee),
    totalEmployer: Math.round(totalEmployer),
  };
}
