import { pgTable, uuid, varchar, decimal, date, boolean, timestamp } from 'drizzle-orm/pg-core';

export const bpjsConfig = pgTable('bpjs_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  component: varchar('component', { length: 50 }).notNull(),
  employeeRate: decimal('employee_rate', { precision: 5, scale: 2 }).notNull(),
  employerRate: decimal('employer_rate', { precision: 5, scale: 2 }).notNull(),
  maxSalaryCap: decimal('max_salary_cap', { precision: 15, scale: 2 }),
  isActive: boolean('is_active').default(true),
  effectiveDate: date('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
