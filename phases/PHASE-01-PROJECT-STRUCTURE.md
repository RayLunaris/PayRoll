# Phase 1: Project Structure Setup

**Objective:** Setup monorepo dan folder structure untuk semua services  
**Estimated Time:** 3-4 hours  
**Prerequisites:** Phase 0 selesai

---

## Tasks

### 1.1 Create Root Directory

```bash
# Buat project root
mkdir payrollpro
cd payrollpro

# Initialize git
git init

# Initialize pnpm workspace
pnpm init
```

### 1.2 Create pnpm-workspace.yaml

```bash
# Buat workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF
```

### 1.3 Create Root package.json

```json
{
  "name": "payrollpro",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter @payrollpro/web dev",
    "dev:gateway": "pnpm --filter @payrollpro/api-gateway dev",
    "dev:auth": "pnpm --filter @payrollpro/auth-service dev",
    "dev:employee": "pnpm --filter @payrollpro/employee-service dev",
    "dev:payroll": "pnpm --filter @payrollpro/payroll-service dev",
    "dev:attendance": "pnpm --filter @payrollpro/attendance-service dev",
    "dev:leave": "pnpm --filter @payrollpro/leave-service dev",
    "dev:social": "pnpm --filter @payrollpro/social-service dev",
    "dev:shift": "pnpm --filter @payrollpro/shift-service dev",
    "dev:all": "pnpm run --parallel dev:*",
    "build": "pnpm run --parallel build:*",
    "db:generate": "pnpm --filter @payrollpro/db generate",
    "db:migrate": "pnpm --filter @payrollpro/db migrate",
    "db:seed": "pnpm --filter @payrollpro/db seed",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f"
  }
}
```

### 1.4 Create Apps Directory Structure

```bash
# Create apps directory
mkdir -p apps

# Frontend
mkdir -p apps/web

# Backend Services
mkdir -p apps/api-gateway
mkdir -p apps/auth-service
mkdir -p apps/employee-service
mkdir -p apps/payroll-service
mkdir -p apps/attendance-service
mkdir -p apps/leave-service
mkdir -p apps/social-service
mkdir -p apps/shift-service
mkdir -p apps/websocket
```

### 1.5 Create Packages Directory Structure

```bash
# Create packages directory
mkdir -p packages

# Shared Types
mkdir -p packages/shared-types/src

# Shared Utils
mkdir -p packages/utils/src

# Database Package
mkdir -p packages/db/src/schema
mkdir -p packages/db/src/migrations
```

### 1.6 Create Docker Directory Structure

```bash
# Create docker directory
mkdir -p docker/postgres
mkdir -p docker/redis
mkdir -p docker/nginx/ssl
```

### 1.7 Create Environment Files

```bash
# Root .env.example
cat > .env.example << 'EOF'
# Database
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/payrollpro

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Services
AUTH_SERVICE_URL=http://localhost:3010
EMPLOYEE_SERVICE_URL=http://localhost:3011
PAYROLL_SERVICE_URL=http://localhost:3012
ATTENDANCE_SERVICE_URL=http://localhost:3013
LEAVE_SERVICE_URL=http://localhost:3014
SOCIAL_SERVICE_URL=http://localhost:3015
SHIFT_SERVICE_URL=http://localhost:3016

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3002
EOF

# Copy to .env
cp .env.example .env
```

### 1.8 Create .gitignore

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/
out/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker
docker-compose.override.yml

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Coverage
coverage/
.nyc_output/

# Temp
tmp/
temp/
EOF
```

### 1.9 Create TypeScript Config (Root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "exclude": ["node_modules", "dist"]
}
```

### 1.10 Create Shared Types Package

```bash
# packages/shared-types/package.json
cat > packages/shared-types/package.json << 'EOF'
{
  "name": "@payrollpro/shared-types",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
EOF

# packages/shared-types/tsconfig.json
cat > packages/shared-types/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
EOF

# packages/shared-types/src/index.ts
cat > packages/shared-types/src/index.ts << 'EOF'
// User Types
export type UserRole = 'super_admin' | 'hr_admin' | 'manager' | 'employee';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Employee Types
export interface Employee {
  id: string;
  userId?: string;
  nip: string;
  fullName: string;
  departmentId: string;
  positionId: string;
  locationId: string;
  phone?: string;
  address?: string;
  birthDate?: Date;
  joinDate: Date;
  baseSalary: number;
  npwp?: string;
  bankName?: string;
  bankAccount?: string;
  photoUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Department Types
export interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Position Types
export interface Position {
  id: string;
  name: string;
  description?: string;
  baseSalary: number;
  grade?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Work Location Types
export interface WorkLocation {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt: Date;
  updatedAt: Date;
}

// Attendance Types
export interface Attendance {
  id: string;
  employeeId: string;
  locationId: string;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  status: 'present' | 'late' | 'absent' | 'half_day' | 'leave';
  overtimeHours: number;
  notes?: string;
  createdAt: Date;
}

// Shift Types
export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  createdAt: Date;
}

// Leave Types
export type LeaveType = 'annual' | 'sick' | 'maternity' | 'paternity' | 'special' | 'unpaid';

export interface Leave {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  reason?: string;
  attachmentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
  createdAt: Date;
}

// Payroll Types
export interface Payroll {
  id: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  baseSalary: number;
  overtimePay: number;
  allowances: number;
  bpjsEmployee: number;
  bpjsEmployer: number;
  taxDeduction: number;
  cashAdvance: number;
  otherDeductions: number;
  netSalary: number;
  status: 'draft' | 'processed' | 'paid' | 'cancelled';
  slipUrl?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Cash Advance Types
export interface CashAdvance {
  id: string;
  employeeId: string;
  amount: number;
  reason?: string;
  month: number;
  year: number;
  status: 'pending' | 'approved' | 'rejected' | 'deducted';
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
}

// Social Types
export interface SocialPost {
  id: string;
  userId: string;
  content: string;
  attachmentUrl?: string;
  postType: 'feed' | 'forum' | 'poll';
  forumCategory?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Message Types
export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

// Announcement Types
export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'urgent';
  attachmentUrl?: string;
  createdBy: string;
  targetAudience: 'all' | 'department' | 'location';
  targetId?: string;
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
EOF
```

### 1.11 Create Initial README

```bash
cat > README.md << 'EOF'
# PayrollPro - Web Payroll System

Sistem web payroll berbasis microservices untuk mengelola penggajian, kehadiran, cuti, dan komunikasi internal perusahaan.

## Tech Stack

- **Frontend:** Next.js 14+, Tailwind CSS, Zustand
- **Backend:** Fastify, TypeScript, Drizzle ORM
- **Database:** PostgreSQL 16, Redis 7
- **Auth:** JWT
- **API:** REST
- **Container:** Docker & Docker Compose
- **Platform:** Arch Linux

## Quick Start

### Prerequisites

- Node.js 22 LTS
- Docker & Docker Compose
- pnpm

### Installation

```bash
# Clone repository
git clone <repository-url>
cd payrollpro

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env

# Start databases
docker-compose up -d postgres redis

# Run migrations
pnpm db:generate
pnpm db:migrate

# Seed data
pnpm db:seed

# Start development servers
pnpm dev:all
```

### Access

- Frontend: http://localhost:3000
- API Gateway: http://localhost:3001
- API Docs: http://localhost:3001/docs

## Documentation

Lihat folder `phases/` untuk dokumentasi lengkap implementasi.

## License

MIT
EOF
```

---

## Verification Checklist

- [x] Root directory monorepo terbuat
- [x] `pnpm-workspace.yaml` terbuat
- [x] `package.json` root terbuat
- [x] Folder `apps/` dengan semua services terbuat
- [x] Folder `packages/` terbuat
- [x] Folder `docker/` terbuat
- [x] `.env.example` dan `.env` terbuat
- [x] `.gitignore` terbuat
- [x] `tsconfig.json` root terbuat
- [x] `packages/shared-types` terbuat dengan types (tervalidasi tsc)
- [x] `README.md` terbuat

---

## Next Phase

Setelah Phase 1 selesai, lanjut ke:
**[Phase 2: Database Setup](./PHASE-02-DATABASE.md)**
