import { pgTable, uuid, varchar, decimal, boolean, timestamp } from 'drizzle-orm/pg-core';

export const overtimeRates = pgTable('overtime_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  multiplier: decimal('multiplier', { precision: 3, scale: 2 }).notNull(),
  dayType: varchar('day_type', { length: 20 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});
