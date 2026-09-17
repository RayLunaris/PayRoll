import { pgTable, uuid, decimal, date, boolean, timestamp } from 'drizzle-orm/pg-core';

export const taxConfig = pgTable('tax_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  bracketFrom: decimal('bracket_from', { precision: 15, scale: 2 }).notNull(),
  bracketTo: decimal('bracket_to', { precision: 15, scale: 2 }),
  rate: decimal('rate', { precision: 5, scale: 2 }).notNull(),
  fixedAmount: decimal('fixed_amount', { precision: 15, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  effectiveDate: date('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
