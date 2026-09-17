import { pgTable, uuid, varchar, time, timestamp, date, unique } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const shifts = pgTable('shifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const employeeShifts = pgTable('employee_shifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  shiftId: uuid('shift_id').references(() => shifts.id),
  date: date('date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  empDateUnique: unique('employee_shifts_emp_date_idx').on(table.employeeId, table.date),
}));

export const shiftSwaps = pgTable('shift_swaps', {
  id: uuid('id').defaultRandom().primaryKey(),
  requesterId: uuid('requester_id').references(() => employees.id),
  targetId: uuid('target_id').references(() => employees.id),
  date: date('date').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
