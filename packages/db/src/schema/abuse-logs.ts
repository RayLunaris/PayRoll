import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const abuseLogs = pgTable('abuse_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  abuseType: varchar('abuse_type', { length: 50 }).notNull(),
  description: text('description'),
  severity: varchar('severity', { length: 20 }),
  detectedAt: timestamp('detected_at').defaultNow(),
  isResolved: boolean('is_resolved').default(false),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
});
