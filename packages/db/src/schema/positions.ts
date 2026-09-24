import { pgTable, uuid, varchar, text, decimal, timestamp, integer } from 'drizzle-orm/pg-core';

export const positions = pgTable('positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).unique(),
  description: text('description'),
  grade: varchar('grade', { length: 10 }),
  levelRank: integer('level_rank').default(1),
  baseSalary: decimal('base_salary', { precision: 15, scale: 2 }).notNull(),
  minSalary: decimal('min_salary', { precision: 15, scale: 2 }),
  maxSalary: decimal('max_salary', { precision: 15, scale: 2 }),
  positionAllowance: decimal('position_allowance', { precision: 15, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
