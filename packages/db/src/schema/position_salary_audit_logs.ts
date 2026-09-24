import { pgTable, uuid, decimal, text, timestamp } from 'drizzle-orm/pg-core';
import { positions } from './positions';
import { users } from './users';

export const positionSalaryAuditLogs = pgTable('position_salary_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  positionId: uuid('position_id').references(() => positions.id, { onDelete: 'cascade' }).notNull(),
  changedByUserId: uuid('changed_by_user_id').references(() => users.id).notNull(),
  oldBaseSalary: decimal('old_base_salary', { precision: 15, scale: 2 }).notNull(),
  newBaseSalary: decimal('new_base_salary', { precision: 15, scale: 2 }).notNull(),
  oldAllowance: decimal('old_allowance', { precision: 15, scale: 2 }),
  newAllowance: decimal('new_allowance', { precision: 15, scale: 2 }),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
