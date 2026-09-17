# Phase 2: Database Setup

**Objective:** Setup PostgreSQL, Drizzle ORM, migrations, dan seed data  
**Estimated Time:** 4-6 hours  
**Prerequisites:** Phase 1 selesai

---

## Tasks

### 2.1 Create PostgreSQL Docker Config

```bash
# docker/postgres/Dockerfile
cat > docker/postgres/Dockerfile << 'EOF'
FROM postgres:16-alpine

# Install additional extensions
RUN apk add --no-cache curl

# Create init script directory
RUN mkdir -p /docker-entrypoint-initdb.d

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD pg_isready -U postgres

# Expose port
EXPOSE 5432
EOF
```

### 2.2 Create Init SQL Script

```bash
# docker/postgres/init.sql
cat > docker/postgres/init.sql << 'EOF'
-- Create database if not exists
SELECT 'CREATE DATABASE payrollpro'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'payrollpro')\gexec

-- Connect to payrollpro database
\c payrollpro;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('super_admin', 'hr_admin', 'manager', 'employee');
CREATE TYPE attendance_status AS ENUM ('present', 'late', 'absent', 'half_day', 'leave');
CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'maternity', 'paternity', 'special', 'unpaid');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE payroll_status AS ENUM ('draft', 'processed', 'paid', 'cancelled');
CREATE TYPE cash_advance_status AS ENUM ('pending', 'approved', 'rejected', 'deducted');
CREATE TYPE post_type AS ENUM ('feed', 'forum', 'poll');
CREATE TYPE announcement_priority AS ENUM ('normal', 'urgent');
CREATE TYPE announcement_target AS ENUM ('all', 'department', 'location');
CREATE TYPE abuse_severity AS ENUM ('low', 'medium', 'high');

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE payrollpro TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
EOF
```

### 2.3 Update docker-compose.yml

```yaml
# Tambahkan ke docker-compose.yml
version: '3.8'

services:
  postgres:
    build:
      context: .
      dockerfile: docker/postgres/Dockerfile
    container_name: payrollpro-postgres
    environment:
      POSTGRES_DB: payrollpro
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: payrollpro-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
EOF
```

### 2.4 Start PostgreSQL

```bash
# Start database containers
docker-compose up -d postgres redis

# Verify containers are running
docker-compose ps

# Check logs
docker-compose logs -f postgres
```

### 2.5 Initialize Drizzle in DB Package

```bash
# packages/db/package.json
cat > packages/db/package.json << 'EOF'
{
  "name": "@payrollpro/db",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "push": "drizzle-kit push",
    "studio": "drizzle-kit studio",
    "seed": "tsx src/seed.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.24.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
EOF

# Install dependencies
cd packages/db && pnpm install && cd ../..
```

### 2.6 Create Drizzle Config

```bash
# packages/db/drizzle.config.ts
cat > packages/db/drizzle.config.ts << 'EOF'
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/*',
  out: './src/migrations',
  driver: 'pg',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/payrollpro',
  },
});
EOF
```

### 2.7 Create Database Schema Files

```bash
# packages/db/src/schema/index.ts
cat > packages/db/src/schema/index.ts << 'EOF'
export * from './users';
export * from './employees';
export * from './departments';
export * from './positions';
export * from './work-locations';
export * from './attendances';
export * from './shifts';
export * from './leaves';
export * from './payrolls';
export * from './cash-advances';
export * from './social-posts';
export * from './messages';
export * from './announcements';
export * from './notifications';
export * from './abuse-logs';
export * from './bpjs-config';
export * from './tax-config';
export * from './overtime-rates';
EOF

# packages/db/src/schema/users.ts
cat > packages/db/src/schema/users.ts << 'EOF'
import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  employeeId: uuid('employee_id'),
  isActive: boolean('is_active').default(true),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
EOF

# packages/db/src/schema/departments.ts
cat > packages/db/src/schema/departments.ts << 'EOF'
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  managerId: uuid('manager_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
EOF

# packages/db/src/schema/positions.ts
cat > packages/db/src/schema/positions.ts << 'EOF'
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
EOF

# packages/db/src/schema/work-locations.ts
cat > packages/db/src/schema/work-locations.ts << 'EOF'
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
EOF

# packages/db/src/schema/employees.ts
cat > packages/db/src/schema/employees.ts << 'EOF'
import { pgTable, uuid, varchar, text, decimal, date, boolean, timestamp } from 'drizzle-orm/pg-core';
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
  bankName: varchar('bank_name', { length: 50 }),
  bankAccount: varchar('bank_account', { length: 50 }),
  photoUrl: text('photo_url'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
EOF

# packages/db/src/schema/attendances.ts
cat > packages/db/src/schema/attendances.ts << 'EOF'
import { pgTable, uuid, date, timestamp, decimal, varchar, text, integer, unique } from 'drizzle-orm/pg-core';
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
  overtimeHours: decimal('overtime_hours', { precision: 4, scale: 2 }).default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueEmployeeDate: unique('unique_employee_date').on(table.employeeId, table.date),
}));
EOF

# packages/db/src/schema/shifts.ts
cat > packages/db/src/schema/shifts.ts << 'EOF'
import { pgTable, uuid, varchar, time, timestamp } from 'drizzle-orm/pg-core';

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
});
EOF

# packages/db/src/schema/leaves.ts
cat > packages/db/src/schema/leaves.ts << 'EOF'
import { pgTable, uuid, varchar, date, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const leaves = pgTable('leaves', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  leaveType: varchar('leave_type', { length: 30 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: text('reason'),
  attachmentUrl: text('attachment_url'),
  status: varchar('status', { length: 20 }).default('pending'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const leaveQuotas = pgTable('leave_quotas', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  leaveType: varchar('leave_type', { length: 30 }).notNull(),
  year: integer('year').notNull(),
  totalQuota: integer('total_quota').notNull(),
  usedQuota: integer('used_quota').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});
EOF

# packages/db/src/schema/payrolls.ts
cat > packages/db/src/schema/payrolls.ts << 'EOF'
import { pgTable, uuid, integer, decimal, varchar, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { employees } from './employees';

export const payrolls = pgTable('payrolls', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  periodMonth: integer('period_month').notNull(),
  periodYear: integer('period_year').notNull(),
  baseSalary: decimal('base_salary', { precision: 15, scale: 2 }).notNull(),
  overtimePay: decimal('overtime_pay', { precision: 15, scale: 2 }).default(0),
  allowances: decimal('allowances', { precision: 15, scale: 2 }).default(0),
  bpjsEmployee: decimal('bpjs_employee', { precision: 15, scale: 2 }).default(0),
  bpjsEmployer: decimal('bpjs_employer', { precision: 15, scale: 2 }).default(0),
  taxDeduction: decimal('tax_deduction', { precision: 15, scale: 2 }).default(0),
  cashAdvance: decimal('cash_advance', { precision: 15, scale: 2 }).default(0),
  otherDeductions: decimal('other_deductions', { precision: 15, scale: 2 }).default(0),
  netSalary: decimal('net_salary', { precision: 15, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft'),
  slipUrl: text('slip_url'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueEmployeePeriod: unique('unique_employee_period').on(table.employeeId, table.periodMonth, table.periodYear),
}));
EOF

# packages/db/src/schema/cash-advances.ts
cat > packages/db/src/schema/cash-advances.ts << 'EOF'
import { pgTable, uuid, integer, decimal, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const cashAdvances = pgTable('cash_advances', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  reason: text('reason'),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
EOF

# packages/db/src/schema/social-posts.ts
cat > packages/db/src/schema/social-posts.ts << 'EOF'
import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const socialPosts = pgTable('social_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  content: text('content').notNull(),
  attachmentUrl: text('attachment_url'),
  postType: varchar('post_type', { length: 20 }).default('feed'),
  forumCategory: varchar('forum_category', { length: 50 }),
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const socialComments = pgTable('social_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => socialPosts.id),
  userId: uuid('user_id').references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const socialLikes = pgTable('social_likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => socialPosts.id),
  userId: uuid('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});
EOF

# packages/db/src/schema/messages.ts
cat > packages/db/src/schema/messages.ts << 'EOF'
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  senderId: uuid('sender_id').references(() => users.id),
  receiverId: uuid('receiver_id').references(() => users.id),
  content: text('content').notNull(),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
EOF

# packages/db/src/schema/announcements.ts
cat > packages/db/src/schema/announcements.ts << 'EOF'
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  priority: varchar('priority', { length: 20 }).default('normal'),
  attachmentUrl: text('attachment_url'),
  createdBy: uuid('created_by').references(() => users.id),
  targetAudience: varchar('target_audience', { length: 20 }).default('all'),
  targetId: uuid('target_id'),
  isPublished: boolean('is_published').default(false),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
EOF

# packages/db/src/schema/notifications.ts
cat > packages/db/src/schema/notifications.ts << 'EOF'
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 30 }),
  referenceId: uuid('reference_id'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
EOF

# packages/db/src/schema/abuse-logs.ts
cat > packages/db/src/schema/abuse-logs.ts << 'EOF'
import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const abuseLogs = pgTable('abuse_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id),
  abuseType: varchar('abuse_type', { length: 50 }).notNull(),
  description: text('description'),
  severity: varchar('severity', { length: 20 }),
  detectedAt: timestamp('detected_at').defaultNow(),
  isResolved: boolean('is_resolved').default(false),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
});
EOF

# packages/db/src/schema/bpjs-config.ts
cat > packages/db/src/schema/bpjs-config.ts << 'EOF'
import { pgTable, uuid, varchar, decimal, date, boolean, timestamp } from 'drizzle-orm/pg-core';

export const bpjsConfig = pgTable('bpjs_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  component: varchar('component', { length: 50 }).notNull(),
  employeeRate: decimal('employee_rate', { precision: 5, scale: 2 }).notNull(),
  employerRate: decimal('employer_rate', { precision: 5, scale: 2 }).notNull(),
  maxSalaryCap: decimal('max_salary_cap', { precision: 15, scale: 2 }),
  isActive: boolean('is_active').default(true),
  effectiveDate: date('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
EOF

# packages/db/src/schema/tax-config.ts
cat > packages/db/src/schema/tax-config.ts << 'EOF'
import { pgTable, uuid, decimal, date, boolean, timestamp } from 'drizzle-orm/pg-core';

export const taxConfig = pgTable('tax_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  bracketFrom: decimal('bracket_from', { precision: 15, scale: 2 }).notNull(),
  bracketTo: decimal('bracket_to', { precision: 15, scale: 2 }),
  rate: decimal('rate', { precision: 5, scale: 2 }).notNull(),
  fixedAmount: decimal('fixed_amount', { precision: 15, scale: 2 }).default(0),
  isActive: boolean('is_active').default(true),
  effectiveDate: date('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
EOF

# packages/db/src/schema/overtime-rates.ts
cat > packages/db/src/schema/overtime-rates.ts << 'EOF'
import { pgTable, uuid, varchar, decimal, boolean, timestamp } from 'drizzle-orm/pg-core';

export const overtimeRates = pgTable('overtime_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  multiplier: decimal('multiplier', { precision: 3, scale: 2 }).notNull(),
  dayType: varchar('day_type', { length: 20 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});
EOF
```

### 2.8 Create Database Index

```bash
# packages/db/src/index.ts
cat > packages/db/src/index.ts << 'EOF'
export * from './schema';
EOF
```

### 2.9 Generate First Migration

```bash
# Generate migration
cd packages/db
pnpm generate

# Check generated migration in src/migrations/
ls -la src/migrations/
```

### 2.10 Run Migration

```bash
# Run migration
pnpm migrate

# Or push schema directly (for development)
pnpm push
```

### 2.11 Create Seed Data

```bash
# packages/db/src/seed.ts
cat > packages/db/src/seed.ts << 'EOF'
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, departments, positions, workLocations, shifts, bpjsConfig, taxConfig, overtimeRates } from './schema';
import { hash } from 'bcrypt';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/payrollpro';
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log('Seeding database...');

  // Seed Super Admin
  const passwordHash = await hash('admin123', 12);
  await db.insert(users).values({
    email: 'admin@payrollpro.com',
    passwordHash,
    role: 'super_admin',
    isActive: true,
  });

  // Seed Departments
  const hrDept = await db.insert(departments).values({
    name: 'Human Resources',
    description: 'HR Department',
  }).returning();

  const itDept = await db.insert(departments).values({
    name: 'Information Technology',
    description: 'IT Department',
  }).returning();

  const financeDept = await db.insert(departments).values({
    name: 'Finance',
    description: 'Finance Department',
  }).returning();

  // Seed Positions
  const managerPos = await db.insert(positions).values({
    name: 'Manager',
    description: 'Department Manager',
    baseSalary: 15000000,
    grade: 'M1',
  }).returning();

  const staffPos = await db.insert(positions).values({
    name: 'Staff',
    description: 'Regular Staff',
    baseSalary: 8000000,
    grade: 'S1',
  }).returning();

  const adminPos = await db.insert(positions).values({
    name: 'Admin',
    description: 'Administrative Staff',
    baseSalary: 6000000,
    grade: 'A1',
  }).returning();

  // Seed Work Locations
  await db.insert(workLocations).values({
    name: 'Head Office',
    address: 'Jl. Sudirman No. 123, Jakarta',
    latitude: -6.2088,
    longitude: 106.8456,
    radiusMeters: 100,
  });

  await db.insert(workLocations).values({
    name: 'Branch Office Bandung',
    address: 'Jl. Asia Afrika No. 456, Bandung',
    latitude: -6.9175,
    longitude: 107.6191,
    radiusMeters: 100,
  });

  // Seed Shifts
  await db.insert(shifts).values([
    { name: 'Pagi', startTime: '08:00', endTime: '16:00' },
    { name: 'Siang', startTime: '12:00', endTime: '20:00' },
    { name: 'Malam', startTime: '20:00', endTime: '04:00' },
  ]);

  // Seed BPJS Config
  await db.insert(bpjsConfig).values([
    { component: 'JKK', employeeRate: 0, employerRate: 0.24, effectiveDate: '2024-01-01' },
    { component: 'JKM', employeeRate: 0, employerRate: 0.30, effectiveDate: '2024-01-01' },
    { component: 'JP', employeeRate: 2, employerRate: 3.70, maxSalaryCap: 12000000, effectiveDate: '2024-01-01' },
    { component: 'JHT', employeeRate: 2, employerRate: 3.70, effectiveDate: '2024-01-01' },
    { component: 'BPJS_KES', employeeRate: 4, employerRate: 4, effectiveDate: '2024-01-01' },
  ]);

  // Seed Tax Config (PPh 21 2024)
  await db.insert(taxConfig).values([
    { bracketFrom: 0, bracketTo: 60000000, rate: 5, fixedAmount: 0, effectiveDate: '2024-01-01' },
    { bracketFrom: 60000000, bracketTo: 250000000, rate: 15, fixedAmount: 3000000, effectiveDate: '2024-01-01' },
    { bracketFrom: 250000000, bracketTo: 500000000, rate: 25, fixedAmount: 31500000, effectiveDate: '2024-01-01' },
    { bracketFrom: 500000000, bracketTo: 5000000000, rate: 30, fixedAmount: 106500000, effectiveDate: '2024-01-01' },
    { bracketFrom: 5000000000, bracketTo: null, rate: 35, fixedAmount: 1606500000, effectiveDate: '2024-01-01' },
  ]);

  // Seed Overtime Rates
  await db.insert(overtimeRates).values([
    { name: 'Weekday', multiplier: 1.5, dayType: 'weekday' },
    { name: 'Weekend', multiplier: 2.0, dayType: 'weekend' },
    { name: 'Holiday', multiplier: 3.0, dayType: 'holiday' },
  ]);

  console.log('Seed completed!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
EOF
```

### 2.12 Run Seed

```bash
# Run seed
cd packages/db
pnpm seed
```

---

## Verification Checklist

- [x] PostgreSQL container running
- [x] Redis container running
- [x] Database `payrollpro` created
- [x] All schema files created
- [x] Migration generated successfully
- [x] Migration applied successfully
- [x] Seed data inserted
- [x] Can connect to database

---

## Database Connection Test

```bash
# Connect to PostgreSQL
docker exec -it payrollpro-postgres psql -U postgres -d payrollpro

# List tables
\dt

# Check seed data
SELECT * FROM users;
SELECT * FROM departments;
SELECT * FROM positions;
```

---

## Next Phase

Setelah Phase 2 selesai, lanjut ke:
**[Phase 3: Auth Service](./PHASE-03-AUTH-SERVICE.md)**
