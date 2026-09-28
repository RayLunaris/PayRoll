import { pgTable, uuid, varchar, text, decimal, date, boolean, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { departments } from './departments';
import { positions } from './positions';
import { workLocations } from './work-locations';

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  nip: varchar('nip', { length: 50 }).unique().notNull(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  positionId: uuid('position_id').references(() => positions.id),
  locationId: uuid('location_id').references(() => workLocations.id),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  birthDate: date('birth_date'),
  joinDate: date('join_date').notNull(),
  baseSalary: decimal('base_salary', { precision: 15, scale: 2 }).notNull(),
  npwp: varchar('npwp', { length: 50 }),
  maritalStatus: varchar('marital_status', { length: 20 }).default('TK/0'),
  dependents: integer('dependents').default(0),
  bankName: varchar('bank_name', { length: 50 }),
  bankAccount: varchar('bank_account', { length: 50 }),
  photoUrl: text('photo_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxEmployeesDepartment: index('idx_employees_department').on(table.departmentId),
  idxEmployeesUserId: index('idx_employees_user_id').on(table.userId),
  idxEmployeesIsActive: index('idx_employees_is_active').on(table.isActive),
}));
