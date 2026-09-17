import { pgTable, uuid, integer, decimal, varchar, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { employees } from './employees';

export const payrolls = pgTable('payrolls', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  periodMonth: integer('period_month').notNull(),
  periodYear: integer('period_year').notNull(),
  baseSalary: decimal('base_salary', { precision: 15, scale: 2 }).notNull(),
  overtimePay: decimal('overtime_pay', { precision: 15, scale: 2 }).default('0'),
  allowances: decimal('allowances', { precision: 15, scale: 2 }).default('0'),
  bpjsEmployee: decimal('bpjs_employee', { precision: 15, scale: 2 }).default('0'),
  bpjsEmployer: decimal('bpjs_employer', { precision: 15, scale: 2 }).default('0'),
  taxDeduction: decimal('tax_deduction', { precision: 15, scale: 2 }).default('0'),
  cashAdvance: decimal('cash_advance', { precision: 15, scale: 2 }).default('0'),
  otherDeductions: decimal('other_deductions', { precision: 15, scale: 2 }).default('0'),
  netSalary: decimal('net_salary', { precision: 15, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft'),
  slipUrl: text('slip_url'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueEmployeePeriod: unique('unique_employee_period').on(table.employeeId, table.periodMonth, table.periodYear),
}));
