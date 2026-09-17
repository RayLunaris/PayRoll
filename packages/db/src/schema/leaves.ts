import { pgTable, uuid, varchar, date, text, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const leaves = pgTable('leaves', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  leaveType: varchar('leave_type', { length: 30 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: text('reason'),
  attachmentUrl: text('attachment_url'),
  status: varchar('status', { length: 20 }).default('pending'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const leaveQuotas = pgTable('leave_quotas', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  leaveType: varchar('leave_type', { length: 30 }).notNull(),
  year: integer('year').notNull(),
  totalQuota: integer('total_quota').notNull(),
  usedQuota: integer('used_quota').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  empTypeYearUnique: unique('leave_quotas_emp_type_year_idx').on(table.employeeId, table.leaveType, table.year),
}));
