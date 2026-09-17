import { pgTable, uuid, varchar, text, decimal, timestamp } from 'drizzle-orm/pg-core';

export const positions = pgTable('positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  baseSalary: decimal('base_salary', { precision: 15, scale: 2 }).notNull(),
  grade: varchar('grade', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
