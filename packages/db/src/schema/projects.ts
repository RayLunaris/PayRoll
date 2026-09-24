import { pgTable, uuid, varchar, decimal, date, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  clientName: varchar('client_name', { length: 150 }),
  managerUserId: uuid('manager_user_id').references(() => users.id),
  totalBudget: decimal('total_budget', { precision: 15, scale: 2 }).notNull(),
  laborBudget: decimal('labor_budget', { precision: 15, scale: 2 }).default('0.00'),
  operationalBudget: decimal('operational_budget', { precision: 15, scale: 2 }).default('0.00'),
  spentLabor: decimal('spent_labor', { precision: 15, scale: 2 }).default('0.00'),
  spentOperational: decimal('spent_operational', { precision: 15, scale: 2 }).default('0.00'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  status: varchar('status', { length: 20 }).default('active'), // 'planning', 'active', 'completed', 'on_hold'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
