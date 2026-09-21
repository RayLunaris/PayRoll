import { pgTable, uuid, date, timestamp, decimal, varchar, text, unique } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { workLocations } from './work-locations';

export const attendances = pgTable('attendances', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  locationId: uuid('location_id').references(() => workLocations.id),
  date: date('date').notNull(),
  checkIn: timestamp('check_in'),
  checkOut: timestamp('check_out'),
  checkInLat: decimal('check_in_lat', { precision: 10, scale: 8 }),
  checkInLng: decimal('check_in_lng', { precision: 11, scale: 8 }),
  checkOutLat: decimal('check_out_lat', { precision: 10, scale: 8 }),
  checkOutLng: decimal('check_out_lng', { precision: 11, scale: 8 }),
  status: varchar('status', { length: 20 }).default('present'),
  overtimeHours: decimal('overtime_hours', { precision: 4, scale: 2 }).default('0'),
  checkInPhotoUrl: text('check_in_photo_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueEmployeeDate: unique('unique_employee_date').on(table.employeeId, table.date),
}));
