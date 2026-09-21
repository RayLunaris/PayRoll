import { pgTable, uuid, date, decimal, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const overtimeRequests = pgTable('overtime_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  date: date('date').notNull(),
  hours: decimal('hours', { precision: 4, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});
