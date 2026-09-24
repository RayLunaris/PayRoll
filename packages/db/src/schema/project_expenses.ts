import { pgTable, uuid, varchar, text, decimal, date, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

export const projectExpenses = pgTable('project_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  expenseTitle: varchar('expense_title', { length: 200 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'cloud_server', 'license', 'travel', 'equipment', 'other'
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  expenseDate: date('expense_date').notNull(),
  receiptUrl: text('receipt_url'),
  submittedByUserId: uuid('submitted_by_user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 20 }).default('approved'), // 'pending', 'approved', 'rejected'
  createdAt: timestamp('created_at').defaultNow(),
});
