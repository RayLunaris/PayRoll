import { pgTable, uuid, decimal, date, varchar, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { employees } from './employees';

export const projectMembers = pgTable('project_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  roleInProject: varchar('role_in_project', { length: 100 }).notNull(), // Misal: "Lead Developer"
  allocationPercentage: decimal('allocation_percentage', { precision: 5, scale: 2 }).default('100.00'), // Contoh: 50.00%
  assignedMonthlyCost: decimal('assigned_monthly_cost', { precision: 15, scale: 2 }).notNull(), // Beban gaji bulanan yang dialokasikan ke proyek
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  createdAt: timestamp('created_at').defaultNow(),
});
