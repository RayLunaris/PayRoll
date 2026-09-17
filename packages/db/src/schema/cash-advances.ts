import { pgTable, uuid, integer, decimal, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const cashAdvances = pgTable('cash_advances', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  reason: text('reason'),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
