import { pgTable, uuid, varchar, text, decimal, integer, timestamp } from 'drizzle-orm/pg-core';

export const workLocations = pgTable('work_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  address: text('address'),
  latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
  longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
  radiusMeters: integer('radius_meters').default(100),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
