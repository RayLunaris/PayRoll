import { pgTable, uuid, varchar, text, decimal, integer, timestamp } from 'drizzle-orm/pg-core';
import { departments } from './departments';

export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  periodYear: integer('period_year').notNull(),
  periodMonth: integer('period_month'), // Null jika tahunan, 1-12 jika bulanan
  category: varchar('category', { length: 30 }).notNull(), // 'payroll', 'project', 'department', 'general'
  departmentId: uuid('department_id').references(() => departments.id),
  allocatedAmount: decimal('allocated_amount', { precision: 15, scale: 2 }).notNull(),
  spentAmount: decimal('spent_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 20 }).default('active'), // 'draft', 'active', 'closed', 'exceeded'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
