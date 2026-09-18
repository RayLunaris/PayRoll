# PRD - Web Payroll System (Microservices Architecture)

**Project Name:** PayrollPro  
**Version:** 1.0.0  
**Date:** September 2026  
**Platform:** Arch Linux  
**Containerization:** Docker & Docker Compose

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Microservices Architecture](#3-microservices-architecture)
4. [Database Schema Design](#4-database-schema-design)
5. [User Flow Diagrams](#5-user-flow-diagrams)
6. [Menu & Features](#6-menu--features)
7. [Implementation Phases](#7-implementation-phases)
8. [Docker Setup](#8-docker-setup)
9. [API Documentation](#9-api-documentation)
10. [Security & Authentication](#10-security--authentication)

---

## 1. Project Overview

### 1.1 Purpose
Sistem web payroll berbasis microservices untuk mengelola penggajian, kehadiran, cuti, dan komunikasi internal perusahaan dengan fitur GPS tracking, perhitungan otomatis BPJS & pajak, serta sosial media internal.

### 1.2 Scope
- Pencatatan kehadiran dengan GPS tracking (radius 100m)
- Penghitungan gaji otomatis (gaji pokok, lembur, potongan)
- Perhitungan BPJS Ketenagakerjaan & Kesehatan
- Perhitungan PPh 21
- Pengelolaan cuti & shifting
- Slip gaji paperless (PDF download)
- Sosial media internal (feed, DM, forum)
- Pengumuman perusahaan
- Kasbon karyawan
- Abuse detection
- Multi lokasi presensi
- Statistik karyawan

### 1.3 Target Users
| Role | Description |
|------|-------------|
| Super Admin | Akses penuh ke semua fitur dan pengaturan sistem |
| HR Admin | Kelola karyawan, gaji, cuti, laporan |
| Manager/Approver | Approval cuti, lembur, akses data tim |
| Employee | Akses data pribadi, ajukan cuti/lembur, presensi |

---

## 2. Tech Stack

### 2.1 Frontend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 14+ (App Router) |
| Language | TypeScript | 5.x |
| UI Library | Tailwind CSS | 3.x |
| State Management | Zustand | 4.x |
| HTTP Client | Axios + Fetch API | - |
| Form Handling | React Hook Form + Zod | - |
| Charts | Recharts | - |
| PDF Generation | React-PDF / jsPDF | - |
| Maps | Leaflet (GPS tracking) | - |
| Icons | Lucide React | - |

### 2.2 Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Fastify | 4.x |
| Language | TypeScript | 5.x |
| ORM | Drizzle ORM | 0.x |
| Validation | Zod | - |
| Authentication | JWT (jsonwebtoken) | - |
| Password Hash | bcrypt | - |
| File Upload | Fastify multipart | - |
| Scheduler | node-cron | - |
| Email | Nodemailer | - |

### 2.3 Database
| Component | Technology | Version |
|-----------|------------|---------|
| Primary DB | PostgreSQL | 16 |
| Cache | Redis | 7.x |
| Migration | Drizzle Kit | - |

### 2.4 DevOps
| Component | Technology |
|-----------|------------|
| Container | Docker |
| Orchestration | Docker Compose |
| Process Manager | pm2 (production) |
| Reverse Proxy | Nginx (production) |

---

## 3. Microservices Architecture

### 3.1 Service Structure (Minimal)

```
┌─────────────────────────────────────────────────────────────┐
│                      NGINX (Reverse Proxy)                  │
│                        Port: 80/443                         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Frontend    │    │  API Gateway  │    │   WebSocket   │
│   (Next.js)  │    │   (Fastify)   │    │    Server     │
│  Port: 3000  │    │  Port: 3001   │    │  Port: 3002   │
└───────────────┘    └───────┬───────┘    └───────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Auth Service │   │Employee Service│   │Payroll Service│
│  Port: 3010   │   │  Port: 3011   │   │  Port: 3012   │
└───────────────┘   └───────────────┘   └───────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   PostgreSQL  │   │     Redis     │   │   MinIO/S3    │
│   Port: 5432  │   │   Port: 6379  │   │  (File Store) │
└───────────────┘   └───────────────┘   └───────────────┘
```

### 3.2 Service Breakdown

| Service | Port | Responsibility |
|---------|------|----------------|
| Frontend (Next.js) | 3000 | UI/UX, client-side rendering |
| API Gateway (Fastify) | 3001 | Route requests, rate limiting, CORS |
| WebSocket Server | 3002 | Real-time notifications, chat |
| Auth Service | 3010 | Login, register, JWT, role management |
| Employee Service | 3011 | CRUD karyawan, profiles, departments |
| Payroll Service | 3012 | Gaji, BPJS, PPh 21, slip gaji |
| Attendance Service | 3013 | Presensi, GPS tracking, lembur |
| Leave Service | 3014 | Cuti, approval workflow |
| Social Service | 3015 | Feed, DM, forum, pengumuman |
| Shift Service | 3016 | Shifting, jadwal kerja |

### 3.3 Communication Flow

```
Client (Browser)
       │
       ▼
  Next.js Frontend ──── REST API ────▶ API Gateway (Fastify)
                                            │
                                            ▼
                              ┌─────────────────────────┐
                              │    Internal Services    │
                              │  (via HTTP/REST calls)  │
                              └─────────────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
              ┌──────────┐           ┌──────────┐           ┌──────────┐
              │   Auth   │           │ Employee │           │ Payroll  │
              └──────────┘           └──────────┘           └──────────┘
                    │                       │                       │
                    ▼                       ▼                       ▼
              ┌──────────┐           ┌──────────┐           ┌──────────┐
              │PostgreSQL│           │PostgreSQL│           │PostgreSQL│
              └──────────┘           └──────────┘           └──────────┘
```

---

## 4. Database Schema Design

### 4.1 Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     users        │       │   departments    │       │    positions     │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ email            │       │ name             │       │ name             │
│ password_hash    │       │ description      │       │ description      │
│ role             │◀──┐   │ created_at       │       │ base_salary      │
│ employee_id (FK) │───┼───│ updated_at       │       │ created_at       │
│ is_active        │   │   └──────────────────┘       │ updated_at       │
│ created_at       │   │                              └──────────────────┘
│ updated_at       │   │
└──────────────────┘   │   ┌──────────────────┐       ┌──────────────────┐
                       │   │   employees      │       │   work_locations │
                       │   ├──────────────────┤       ├──────────────────┤
                       │   │ id (PK)          │       │ id (PK)          │
                       ├───│ user_id (FK)     │       │ name             │
                       │   │ nip              │       │ address          │
                       │   │ full_name        │       │ latitude         │
                       │   │ department_id(FK)│◀──┐   │ longitude        │
                       │   │ position_id (FK) │───┼───│ radius_meters    │
                       │   │ location_id (FK) │───┤   │ created_at       │
                       │   │ phone            │   │   └──────────────────┘
                       │   │ address          │   │
                       │   │ birth_date       │   │   ┌──────────────────┐
                       │   │ join_date        │   │   │   attendances    │
                       │   │ base_salary      │   │   ├──────────────────┤
                       │   │ npwp             │   │   │ id (PK)          │
                       │   │ bank_name        │   │   │ employee_id (FK) │──┐
                       │   │ bank_account     │   │   │ location_id (FK) │──┤
                       │   │ photo_url        │   │   │ date             │  │
                       │   │ is_active        │   │   │ check_in         │  │
                       │   │ created_at       │   │   │ check_out        │  │
                       │   │ updated_at       │   │   │ check_in_lat     │  │
                       └──────────────────┘   │   │   │ check_in_lng     │  │
                                              │   │   │ check_out_lat    │  │
                                              │   │   │ check_out_lng    │  │
                                              │   │   │ status           │  │
                                              │   │   │ overtime_hours   │  │
                                              │   │   │ notes            │  │
                                              │   │   │ created_at       │  │
                                              │   │   └──────────────────┘  │
                                              │   │                         │
                                              │   │   ┌──────────────────┐  │
                                              │   │   │    payrolls      │  │
                                              │   │   ├──────────────────┤  │
                                              │   │   │ id (PK)          │  │
                                              │   │   │ employee_id (FK) │◀─┘
                                              │   │   │ period_month     │
                                              │   │   │ period_year      │
                                              │   │   │ base_salary      │
                                              │   │   │ overtime_pay     │
                                              │   │   │ allowances       │
                                              │   │   │ bpjs_deduction   │
                                              │   │   │ tax_deduction    │
                                              │   │   │ cash_advance     │
                                              │   │   │ other_deductions │
                                              │   │   │ net_salary       │
                                              │   │   │ status           │
                                              │   │   │ slip_url         │
                                              │   │   │ created_at       │
                                              │   │   └──────────────────┘
                                              │   │
                                              │   │   ┌──────────────────┐
                                              │   │   │    leaves        │
                                              │   │   ├──────────────────┤
                                              │   │   │ id (PK)          │
                                              │   │   │ employee_id (FK) │◀─┘
                                              │   │   │ leave_type       │
                                              │   │   │ start_date       │
                                              │   │   │ end_date         │
                                              │   │   │ reason           │
                                              │   │   │ attachment_url   │
                                              │   │   │ status           │
                                              │   │   │ approved_by (FK) │
                                              │   │   │ approved_at      │
                                              │   │   │ created_at       │
                                              │   │   └──────────────────┘
                                              │   │
                                              │   │   ┌──────────────────┐
                                              │   │   │   cash_advances  │
                                              │   │   ├──────────────────┤
                                              │   │   │ id (PK)          │
                                              │   │   │ employee_id (FK) │◀─┘
                                              │   │   │ amount           │
                                              │   │   │ reason           │
                                              │   │   │ month            │
                                              │   │   │ year             │
                                              │   │   │ status           │
                                              │   │   │ approved_by (FK) │
                                              │   │   │ created_at       │
                                              │   │   └──────────────────┘
                                              │
                                              │   ┌──────────────────┐
                                              │   │    shifts         │
                                              │   ├──────────────────┤
                                              │   │ id (PK)          │
                                              │   │ name             │
                                              │   │ start_time       │
                                              │   │ end_time         │
                                              │   │ created_at       │
                                              │   └──────────────────┘
                                                      │
                                                      │   ┌──────────────────┐
                                                      │   │ employee_shifts  │
                                                      │   ├──────────────────┤
                                                      │   │ id (PK)          │
                                                      │   │ employee_id (FK) │
                                                      │   │ shift_id (FK)    │
                                                      │   │ date             │
                                                      │   │ created_at       │
                                                      │   └──────────────────┘
```

### 4.2 Core Tables SQL (PostgreSQL)

```sql
-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'hr_admin', 'manager', 'employee')),
    employee_id UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Departments Table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Positions Table
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_salary DECIMAL(15,2) NOT NULL,
    grade VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Work Locations Table
CREATE TABLE work_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address TEXT,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    radius_meters INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Employees Table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    nip VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    department_id UUID REFERENCES departments(id),
    position_id UUID REFERENCES positions(id),
    location_id UUID REFERENCES work_locations(id),
    phone VARCHAR(20),
    address TEXT,
    birth_date DATE,
    join_date DATE NOT NULL,
    base_salary DECIMAL(15,2) NOT NULL,
    npwp VARCHAR(50),
    bank_name VARCHAR(50),
    bank_account VARCHAR(50),
    photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Attendances Table
CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    location_id UUID REFERENCES work_locations(id),
    date DATE NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    check_in_lat DECIMAL(10,8),
    check_in_lng DECIMAL(11,8),
    check_out_lat DECIMAL(10,8),
    check_out_lng DECIMAL(11,8),
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'half_day', 'leave')),
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- Shifts Table
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Employee Shifts Table
CREATE TABLE employee_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    shift_id UUID REFERENCES shifts(id),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- Leaves Table
CREATE TABLE leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    leave_type VARCHAR(30) NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'paternity', 'special', 'unpaid')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    attachment_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Leave Quotas Table
CREATE TABLE leave_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    leave_type VARCHAR(30) NOT NULL,
    year INT NOT NULL,
    total_quota INT NOT NULL,
    used_quota INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, leave_type, year)
);

-- Payrolls Table
CREATE TABLE payrolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    period_month INT NOT NULL,
    period_year INT NOT NULL,
    base_salary DECIMAL(15,2) NOT NULL,
    overtime_pay DECIMAL(15,2) DEFAULT 0,
    allowances DECIMAL(15,2) DEFAULT 0,
    bpjs_employee DECIMAL(15,2) DEFAULT 0,
    bpjs_employer DECIMAL(15,2) DEFAULT 0,
    tax_deduction DECIMAL(15,2) DEFAULT 0,
    cash_advance DECIMAL(15,2) DEFAULT 0,
    other_deductions DECIMAL(15,2) DEFAULT 0,
    net_salary DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'paid', 'cancelled')),
    slip_url TEXT,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(employee_id, period_month, period_year)
);

-- Cash Advances Table
CREATE TABLE cash_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    month INT NOT NULL,
    year INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'deducted')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Overtime Rates Table
CREATE TABLE overtime_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    multiplier DECIMAL(3,2) NOT NULL,
    day_type VARCHAR(20) CHECK (day_type IN ('weekday', 'weekend', 'holiday')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Announcements Table
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    attachment_url TEXT,
    created_by UUID REFERENCES users(id),
    target_audience VARCHAR(20) DEFAULT 'all' CHECK (target_audience IN ('all', 'department', 'location')),
    target_id UUID,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Social Posts Table
CREATE TABLE social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    attachment_url TEXT,
    post_type VARCHAR(20) DEFAULT 'feed' CHECK (post_type IN ('feed', 'forum', 'poll')),
    forum_category VARCHAR(50),
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Social Comments Table
CREATE TABLE social_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES social_posts(id),
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Social Likes Table
CREATE TABLE social_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES social_posts(id),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Messages Table (Direct Messaging)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Abuse Detection Log Table
CREATE TABLE abuse_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    abuse_type VARCHAR(50) NOT NULL,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high')),
    detected_at TIMESTAMP DEFAULT NOW(),
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP
);

-- Notification Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30),
    reference_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- BPJS Configuration Table
CREATE TABLE bpjs_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component VARCHAR(50) NOT NULL,
    employee_rate DECIMAL(5,2) NOT NULL,
    employer_rate DECIMAL(5,2) NOT NULL,
    max_salary_cap DECIMAL(15,2),
    is_active BOOLEAN DEFAULT true,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tax Configuration Table (PPh 21)
CREATE TABLE tax_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bracket_from DECIMAL(15,2) NOT NULL,
    bracket_to DECIMAL(15,2),
    rate DECIMAL(5,2) NOT NULL,
    fixed_amount DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. User Flow Diagrams

### 5.1 Login Flow

```
┌─────────────┐
│   Start     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Open Login  │
│   Page      │
└──────┬──────┘
       │
       ▼
┌─────────────┐     No      ┌─────────────┐
│ Is Account  │────────────▶│ Show Error  │
│   Valid?    │             │ "Invalid    │
└──────┬──────┘             │  Credentials│
       │ Yes                └─────────────┘
       ▼
┌─────────────┐
│ Generate    │
│ JWT Token   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Redirect to │
│  Dashboard  │
└─────────────┘
```

### 5.2 Attendance Flow (GPS Tracking)

```
┌─────────────┐
│   Start     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Employee    │
│ Opens App   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     No      ┌─────────────┐
│  Request    │────────────▶│ Show Error  │
│  GPS        │             │ "Location   │
│ Permission  │             │  Required"  │
└──────┬──────┘             └─────────────┘
       │ Yes
       ▼
┌─────────────┐
│ Get Current │
│  Location   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     No      ┌─────────────┐
│ Is Inside   │────────────▶│ Show Error  │
│  Radius?    │             │ "Outside    │
│  (100m)     │             │  Work Area" │
└──────┬──────┘             └─────────────┘
       │ Yes
       ▼
┌─────────────┐
│ Record      │
│ Check-in    │
│ + GPS Data  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Start Timer │
│ for Shift   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Working    │
│   Hours     │
└──────┬──────┘
       │
       ▼
┌─────────────┐     No      ┌─────────────┐
│  Employee   │────────────▶│  Auto       │
│  Check-out? │             │  Check-out  │
└──────┬──────┘             │  at Shift   │
       │ Yes                │  End        │
       ▼                    └──────┬──────┘
┌─────────────┐                    │
│ Record      │◀───────────────────┘
│ Check-out   │
│ + GPS Data  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Calculate   │
│ Overtime    │
│ (if any)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   End       │
└─────────────┘
```

### 5.3 Leave Request Flow

```
┌─────────────┐
│   Start     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Employee    │
│ Opens Leave │
│ Menu        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Select Leave │
│ Type & Date │
└──────┬──────┘
       │
       ▼
┌─────────────┐     No      ┌─────────────┐
│ Has Enough  │────────────▶│ Show Error  │
│  Quota?     │             │ "Insufficient│
└──────┬──────┘             │  Quota"     │
       │ Yes                └─────────────┘
       ▼
┌─────────────┐
│ Submit      │
│ Request     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Notify      │
│ Manager     │
└──────┬──────┘
       │
       ▼
┌─────────────┐     No      ┌─────────────┐
│  Manager    │────────────▶│  Reject &   │
│  Approve?   │             │  Notify     │
└──────┬──────┘             └──────┬──────┘
       │ Yes                       │
       ▼                           │
┌─────────────┐                    │
│  Update     │                    │
│  Quota      │◀───────────────────┘
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Notify      │
│ Employee    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   End       │
└─────────────┘
```

### 5.4 Payroll Processing Flow

```
┌─────────────┐
│   Start     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ HR Admin    │
│ Initiates   │
│ Payroll     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Select      │
│ Pay Period  │
│ (Month/Year)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Fetch All   │
│ Active      │
│ Employees   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│           For Each Employee:                │
├─────────────────────────────────────────────┤
│ 1. Get Base Salary from Position           │
│ 2. Calculate Overtime Pay                  │
│    - Fetch attendance records              │
│    - Apply overtime rates                  │
│ 3. Calculate Allowances                    │
│ 4. Calculate BPJS Deductions               │
│    - Employee portion                       │
│    - Employer portion                       │
│ 5. Calculate PPh 21 Tax                    │
│    - Apply progressive rates               │
│ 6. Deduct Cash Advances                    │
│ 7. Calculate Net Salary                    │
│ 8. Create Payroll Record                   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────┐
│ Generate    │
│ Payslips    │
│ (PDF)       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ HR Reviews  │
│ & Confirms  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Mark as     │
│ Paid        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Notify All  │
│ Employees   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   End       │
└─────────────┘
```

### 5.5 Social Media Flow

```
┌─────────────┐
│   Start     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Open Social │
│   Menu      │
└──────┬──────┘
       │
       ├──────────────────┬──────────────────┐
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Feed      │    │  Direct     │    │   Forum     │
│   View      │    │  Message    │    │   View      │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Like/Comment│    │ Send/Receive│    │ Create Post │
│ Share       │    │ Messages    │    │ Reply       │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Real-time   │
                    │ Updates     │
                    │ (WebSocket) │
                    └─────────────┘
```

---

## 6. Menu & Features

### 6.1 Menu Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        SIDEBAR MENU                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Dashboard                                              │   │
│  │  ├── Overview (stats, charts)                           │   │
│  │  ├── Today's Activity                                   │   │
│  │  └── Notifications                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Attendance (Kehadiran)                                 │   │
│  │  ├── Check-in / Check-out (GPS)                         │   │
│  │  ├── Attendance History                                 │   │
│  │  ├── Attendance Report                                  │   │
│  │  └── Abuse Detection                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Leave (Cuti)                                           │   │
│  │  ├── Request Leave                                      │   │
│  │  ├── Leave History                                      │   │
│  │  ├── Leave Quota                                        │   │
│  │  ├── Approval Queue (Manager)                           │   │
│  │  └── Leave Calendar                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Overtime (Lembur)                                      │   │
│  │  ├── Request Overtime                                   │   │
│  │  ├── Overtime History                                   │   │
│  │  ├── Overtime Approval (Manager)                        │   │
│  │  └── Overtime Report                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Payroll (Gaji)                                         │   │
│  │  ├── Process Payroll (HR)                               │   │
│  │  ├── Payslip View (Employee)                            │   │
│  │  ├── Payslip Download (PDF)                             │   │
│  │  ├── BPJS Report                                        │   │
│  │  ├── Tax Report (PPh 21)                                │   │
│  │  └── Cash Advance Management                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Shift (Jadwal)                                         │   │
│  │  ├── Shift Management (HR)                              │   │
│  │  ├── Employee Schedule                                  │   │
│  │  ├── Shift Swap Request                                 │   │
│  │  └── Shift Calendar                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Employee (Karyawan) [HR Admin]                         │   │
│  │  ├── Employee List                                      │   │
│  │  ├── Add Employee                                       │   │
│  │  ├── Edit Employee                                      │   │
│  │  ├── Employee Profile                                   │   │
│  │  ├── Department Management                              │   │
│  │  ├── Position Management                                │   │
│  │  └── Work Location Management                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Social (Internal)                                      │   │
│  │  ├── Feed (Postingan)                                   │   │
│  │  ├── Direct Messages                                    │   │
│  │  ├── Forum (Diskusi)                                    │   │
│  │  └── Announcements (Pengumuman)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Reports (Laporan) [HR/Manager]                         │   │
│  │  ├── Attendance Report                                  │   │
│  │  ├── Leave Report                                       │   │
│  │  ├── Overtime Report                                    │   │
│  │  ├── Payroll Summary                                    │   │
│  │  ├── Employee Statistics                                │   │
│  │  └── Export to Excel/PDF                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Settings (Pengaturan) [Super Admin]                    │   │
│  │  ├── System Settings                                    │   │
│  │  ├── BPJS Configuration                                 │   │
│  │  ├── Tax Configuration (PPh 21)                         │   │
│  │  ├── Overtime Rates                                     │   │
│  │  ├── Leave Types Configuration                          │   │
│  │  ├── User Management                                    │   │
│  │  └── Audit Logs                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Feature Explanations

#### 6.2.1 GPS Attendance (Pencatatan Kehadiran dengan GPS Tracking)
**Description:** Sistem presensi digital dengan verifikasi lokasi GPS.

**How it works:**
- Karyawan membuka aplikasi dan menekan tombol "Check-in"
- Aplikasi meminta izin GPS dan mendapatkan lokasi saat ini
- Sistem memverifikasi apakah karyawan berada dalam radius 100m dari lokasi kerja yang ditentukan
- Jika valid, presensi dicatat beserta koordinat GPS
- Jika di luar radius, sistem menolak presensi dan menampilkan peringatan

**Features:**
- Real-time GPS validation
- Multi-location support (kantor pusat, cabang)
- History presensi dengan peta
- Auto check-out saat shift berakhir
- Late detection dan overtime calculation

#### 6.2.2 BPJS Calculation (Penghitungan BPJS Ketenagakerjaan)
**Description:** Perhitungan otomatis kontribusi BPJS Ketenagakerjaan dan Kesehatan.

**Components:**
| Component | Employee Rate | Employer Rate |
|-----------|---------------|---------------|
| JKK (Jaminan Kecelakaan Kerja) | 0% | 0.24% - 1.74% |
| JKM (Jaminan Kematian) | 0% | 0.30% |
| JP (Jaminan Pensiun) | 2% | 3.70% |
| JHT (Jaminan Hari Tua) | 2% | 3.70% |
| BPJS Kesehatan | 4% | 4% |

**Calculation:**
- Gaji pokok + tunjangan tetap = Gaji kotor
- Apply percentage based on component
- Deduct from employee salary
- Employer portion is additional cost

#### 6.2.3 Tax Calculation (Penghitungan PPh 21)
**Description:** Perhitungan pajak penghasilan pegawai sesuai regulasi Indonesia.

**Progressive Tax Rates (2024):**
| Bracket | Range (Annual) | Rate |
|---------|----------------|------|
| 1 | s/d Rp 60.000.000 | 5% |
| 2 | > Rp 60.000.000 s/d Rp 250.000.000 | 15% |
| 3 | > Rp 250.000.000 s/d Rp 500.000.000 | 25% |
| 4 | > Rp 500.000.000 s/d Rp 5.000.000.000 | 30% |
| 5 | > Rp 5.000.000.000 | 35% |

**Calculation:**
- Annual gross salary
- Subtract non-taxable income (PTKP)
- Apply progressive rates
- Monthly deduction = Annual tax / 12

#### 6.2.4 Access Control (Pembatasan Akses User)
**Description:** Sistem role-based access control (RBAC) untuk membatasi akses fitur.

**Roles & Permissions:**
| Role | Permissions |
|------|-------------|
| Super Admin | Full access to all features |
| HR Admin | Employee management, payroll, reports, announcements |
| Manager | Team attendance, leave approval, overtime approval |
| Employee | Personal data, attendance, leave requests, social |

#### 6.2.5 Paperless Payslip (Slip Gaji Paperless)
**Description:** Slip gaji digital dalam format PDF.

**Features:**
- Generate PDF slip gaji setiap bulan
- Detail pendapatan dan potongan
- Download langsung dari aplikasi
- Tersimpan di database untuk akses history
- Format profesional dan terbaca

#### 6.2.6 Internal Social Media (Sosial Media Internal)
**Description:** Platform komunikasi internal perusahaan.

**Sub-features:**
1. **Feed (Postingan)**
   - Buat postingan teks + gambar
   - Like dan komentar
   - Share ke department tertentu

2. **Direct Messages**
   - Chat personal antar karyawan
   - Real-time messaging via WebSocket
   - Read receipt

3. **Discussion Forum**
   - Forum per departemen/ topik
   - Kategori diskusi
   - Threaded comments

4. **Announcements (Pengumuman)**
   - Pengumuman perusahaan
   - Priority levels (normal, urgent)
   - Target audience (all, department, location)

#### 6.2.7 Cash Advance (Pencatatan Kasbon)
**Description:** Sistem pengajuan dan pencatatan pinjaman karyawan.

**Rules:**
- Maksimal 25% gaji per bulan
- Sekali pengajuan per bulan
- Membutuhkan approval HR
- Otomatis dipotong dari gaji
- Status tracking (pending, approved, deducted)

#### 6.2.8 Overtime Calculation (Penghitungan Lembur Otomatis)
**Description:** Perhitungan jam lembur dan upah lembur otomatis.

**Custom Rates:**
- Admin dapat mengatur rate per kategori hari
- Weekday: 1.5x (default, bisa dikustom)
- Weekend: 2x (default, bisa dikustom)
- Holiday: 3x (default, bisa dikustom)

**Calculation:**
- Jam lembur = Jam check-out - Jam shift berakhir
- Upah lembur = Jam lembur × Rate × (Gaji / 173)

#### 6.2.9 Leave Application via Smartphone (Pengajuan Cuti Melalui Smartphone)
**Description:** Sistem pengajuan cuti berbasis mobile.

**Features:**
- Form pengajuan cuti mobile-friendly
- Pilih tipe cuti dan tanggal
- Upload surat keterangan (untuk cuti sakit)
- Notifikasi ke manager untuk approval
- Status tracking real-time

#### 6.2.10 Employee Shifting (Pengelolaan Shifting Karyawan)
**Description:** Pengelolaan jadwal shift kerja karyawan.

**Fixed Shifts:**
| Shift | Time |
|-------|------|
| Pagi (Morning) | 08:00 - 16:00 |
| Siang (Afternoon) | 12:00 - 20:00 |
| Malam (Night) | 20:00 - 04:00 |

**Features:**
- Assign shift per karyawan per hari
- Calendar view untuk jadwal
- Shift swap request
- Auto-rotate shift (optional)

#### 6.2.11 Employee Statistics (Statistik Karyawan)
**Description:** Dashboard statistik dan analitik karyawan.

**Metrics:**
- Total karyawan aktif
- Kehadiran rata-rata
- Tingkat cuti
- Distribusi departemen
- Turnover rate
- Age distribution
- Tenure distribution

#### 6.2.12 Multi-Location Attendance (Multi Lokasi Presensi)
**Description:** Presensi di beberapa lokasi kerja tetap.

**Features:**
- Daftar lokasi kerja (kantor pusat, cabang)
- Setiap lokasi punya koordinat dan radius
- Karyawan dapat presensi di lokasi yang ditugaskan
- Laporan per lokasi

#### 6.2.13 Special Leave Types (Pengaturan Cuti Khusus)
**Description:** Berbagai tipe cuti yang didukung.

**Leave Types:**
| Type | Description | Default Quota |
|------|-------------|---------------|
| Annual | Cuti tahunan | 12 days/year |
| Sick | Cuti sakit | 12 days/year |
| Maternity | Cuti melahirkan | 90 days |
| Paternity | Cuti ayah | 3 days |
| Special | Cuti khusus (nikah, duka, haji) | Configurable |
| Unpaid | Cuti tanpa gaji | Unlimited |

#### 6.2.14 Abuse Detection
**Description:** Deteksi penyalahgunaan sistem.

**Detected Abuses:**
- GPS spoofing attempt
- Check-in from unusual location
- Multiple devices login
- Abnormal overtime patterns
- Frequent late check-ins
- Buddy punching detection

**Response:**
- Log abuse event
- Alert HR admin
- Severity levels (low, medium, high)
- Manual review & resolution

---

## 7. Implementation Phases

### Phase 0: Environment Setup (Arch Linux)

| Step | Task | Command/Action |
|------|------|----------------|
| 0.1 | Update system | `sudo pacman -Syu` |
| 0.2 | Install Node.js 22 LTS | `sudo pacman -S nodejs npm` |
| 0.3 | Verify Node.js | `node -v` (should be v22.x) |
| 0.4 | Install Docker | `sudo pacman -S docker` |
| 0.5 | Install Docker Compose | `sudo pacman -S docker-compose` |
| 0.6 | Enable Docker service | `sudo systemctl enable --now docker` |
| 0.7 | Add user to docker group | `sudo usermod -aG docker $USER` |
| 0.8 | Install Git | `sudo pacman -S git` |
| 0.9 | Install pnpm | `npm install -g pnpm` |
| 0.10 | Install VS Code (optional) | `yay -S visual-studio-code-bin` |
| 0.11 | Verify Docker | `docker --version` |
| 0.12 | Verify Docker Compose | `docker-compose --version` |

### Phase 1: Project Structure Setup

| Step | Task | Description |
|------|------|-------------|
| 1.1 | Create root directory | `mkdir payrollpro && cd payrollpro` |
| 1.2 | Initialize monorepo | `pnpm init` |
| 1.3 | Create workspace config | Configure `pnpm-workspace.yaml` |
| 1.4 | Create frontend directory | `mkdir -p apps/web` |
| 1.5 | Create backend directories | `mkdir -p apps/{api-gateway,auth-service,employee-service,payroll-service,attendance-service,leave-service,social-service,shift-service}` |
| 1.6 | Create shared packages | `mkdir -p packages/{shared-types,utils,db}` |
| 1.7 | Create docker directory | `mkdir -p docker/{postgres,redis,nginx}` |
| 1.8 | Create config files | `.gitignore`, `.env.example`, `docker-compose.yml` |

### Phase 2: Database Setup

| Step | Task | Description |
|------|------|-------------|
| 2.1 | Create PostgreSQL Docker config | `docker/postgres/Dockerfile` |
| 2.2 | Create init SQL script | `docker/postgres/init.sql` |
| 2.3 | Configure docker-compose.yml | Add PostgreSQL service |
| 2.4 | Start PostgreSQL | `docker-compose up -d postgres` |
| 2.5 | Initialize Drizzle in db package | `packages/db/package.json` |
| 2.6 | Create Drizzle config | `drizzle.config.ts` |
| 2.7 | Define schema files | All table schemas in `packages/db/src/schema/` |
| 2.8 | Create first migration | `pnpm drizzle-kit generate` |
| 2.9 | Run migration | `pnpm drizzle-kit migrate` |
| 2.10 | Seed initial data | Admin user, default shifts, BPJS config |

### Phase 3: Backend - Auth Service

| Step | Task | Description |
|------|------|-------------|
| 3.1 | Initialize Fastify project | `apps/auth-service/package.json` |
| 3.2 | Configure TypeScript | `tsconfig.json` |
| 3.3 | Create auth routes | `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh` |
| 3.4 | Implement JWT logic | Token generation, verification, refresh |
| 3.5 | Create middleware | JWT verification middleware |
| 3.6 | Create role middleware | Role-based access control |
| 3.7 | Password hashing | bcrypt implementation |
| 3.8 | Input validation | Zod schemas for auth endpoints |
| 3.9 | Create Dockerfile | Multi-stage build for auth service |
| 3.10 | Add to docker-compose | Auth service configuration |
| 3.11 | Test endpoints | Use curl/Postman to verify |

### Phase 4: Backend - Employee Service

| Step | Task | Description |
|------|------|-------------|
| 4.1 | Create employee routes | CRUD endpoints |
| 4.2 | Create department routes | CRUD endpoints |
| 4.3 | Create position routes | CRUD endpoints |
| 4.4 | Create location routes | CRUD endpoints |
| 4.5 | Implement GPS validation | Haversine formula for distance |
| 4.6 | Create employee profile endpoint | GET `/api/employees/:id/profile` |
| 4.7 | File upload for photo | Fastify multipart |
| 4.8 | Pagination & filtering | Query parameters support |
| 4.9 | Create Dockerfile | Multi-stage build |
| 4.10 | Add to docker-compose | Employee service configuration |
| 4.11 | Test all CRUD operations | Verify with test data |

### Phase 5: Backend - Attendance Service

| Step | Task | Description |
|------|------|-------------|
| 5.1 | Create check-in endpoint | POST `/api/attendance/check-in` with GPS |
| 5.2 | Create check-out endpoint | POST `/api/attendance/check-out` |
| 5.3 | Implement GPS validation | Verify location within radius |
| 5.4 | Create attendance history | GET `/api/attendance/history` |
| 5.5 | Implement overtime calculation | Auto-calculate after shift ends |
| 5.6 | Create abuse detection | Detect GPS spoofing, unusual patterns |
| 5.7 | Auto check-out scheduler | Node-cron for automatic checkout |
| 5.8 | Create attendance report | GET `/api/attendance/report` |
| 5.9 | Create Dockerfile | Multi-stage build |
| 5.10 | Add to docker-compose | Attendance service configuration |
| 5.11 | Test GPS check-in/out | Simulate different locations |

### Phase 6: Backend - Leave Service

| Step | Task | Description |
|------|------|-------------|
| 6.1 | Create leave request endpoint | POST `/api/leaves/request` |
| 6.2 | Create leave approval endpoint | PUT `/api/leaves/:id/approve` |
| 6.3 | Create leave history | GET `/api/leaves/history` |
| 6.4 | Implement leave quota | Check and update quota |
| 6.5 | Create leave calendar | GET `/api/leaves/calendar` |
| 6.6 | Notification to manager | On leave request |
| 6.7 | Notification to employee | On approval/rejection |
| 6.8 | Special leave types | Configure different leave types |
| 6.9 | Create Dockerfile | Multi-stage build |
| 6.10 | Add to docker-compose | Leave service configuration |
| 6.11 | Test leave workflow | Request → Approve → Deduct quota |

### Phase 7: Backend - Payroll Service

| Step | Task | Description |
|------|------|-------------|
| 7.1 | Create payroll processing endpoint | POST `/api/payrolls/process` |
| 7.2 | Implement BPJS calculation | Employee & employer portions |
| 7.3 | Implement PPh 21 calculation | Progressive tax rates |
| 7.4 | Implement overtime pay | Based on custom rates |
| 7.5 | Implement cash advance deduction | Max 25% rule |
| 7.6 | Create payslip generation | PDF generation |
| 7.7 | Create payslip download | GET `/api/payrolls/:id/slip` |
| 7.8 | Create payroll report | Summary by department |
| 7.9 | Cash advance management | CRUD + approval |
| 7.10 | Create Dockerfile | Multi-stage build |
| 7.11 | Add to docker-compose | Payroll service configuration |
| 7.12 | Test full payroll process | End-to-end with real data |

### Phase 8: Backend - Shift Service

| Step | Task | Description |
|------|------|-------------|
| 8.1 | Create shift CRUD endpoints | GET/POST/PUT/DELETE `/api/shifts` |
| 8.2 | Create employee shift assignment | POST `/api/employee-shifts` |
| 8.3 | Create shift calendar view | GET `/api/shifts/calendar` |
| 8.4 | Implement shift swap | POST `/api/shifts/swap` |
| 8.5 | Create shift report | Attendance per shift |
| 8.6 | Create Dockerfile | Multi-stage build |
| 8.7 | Add to docker-compose | Shift service configuration |

### Phase 9: Backend - Social Service

| Step | Task | Description |
|------|------|-------------|
| 9.1 | Create post endpoints | CRUD for feed posts |
| 9.2 | Create comment endpoints | Add/remove comments |
| 9.3 | Create like endpoints | Like/unlike posts |
| 9.4 | Create DM endpoints | Send/receive messages |
| 9.5 | Create forum endpoints | Forum categories & threads |
| 9.6 | Create announcement endpoints | CRUD + publish |
| 9.7 | Implement WebSocket | Real-time messaging |
| 9.8 | File upload for posts | Images, documents |
| 9.9 | Create Dockerfile | Multi-stage build |
| 9.10 | Add to docker-compose | Social service configuration |

### Phase 10: Backend - API Gateway

| Step | Task | Description |
|------|------|-------------|
| 10.1 | Create route aggregation | Route to appropriate services |
| 10.2 | Implement rate limiting | Protect against abuse |
| 10.3 | Configure CORS | Allow frontend origin |
| 10.4 | Request validation | Zod validation middleware |
| 10.5 | Error handling | Standardized error responses |
| 10.6 | Logging | Request/response logging |
| 10.7 | Health check endpoints | GET `/health` |
| 10.8 | Create Dockerfile | Multi-stage build |
| 10.9 | Add to docker-compose | API Gateway configuration |

### Phase 11: Frontend - Project Setup

| Step | Task | Description |
|------|------|-------------|
| 11.1 | Initialize Next.js project | `npx create-next-app@latest apps/web` |
| 11.2 | Configure TypeScript | Strict mode, path aliases |
| 11.3 | Install Tailwind CSS | Already included in Next.js |
| 11.4 | Install Zustand | State management |
| 11.5 | Install Axios | HTTP client |
| 11.6 | Install React Hook Form | Form handling |
| 11.7 | Install Zod | Validation |
| 11.8 | Install Lucide React | Icons |
| 11.9 | Install Recharts | Charts |
| 11.10 | Create folder structure | Components, pages, stores, lib |
| 11.11 | Configure API base URL | Environment variables |
| 11.12 | Create Dockerfile | Multi-stage build |

### Phase 12: Frontend - Auth Pages

| Step | Task | Description |
|------|------|-------------|
| 12.1 | Create login page | Email, password form |
| 12.2 | Create register page | Employee registration |
| 12.3 | Implement auth store | Zustand for auth state |
| 12.4 | Create auth middleware | Protect routes |
| 12.5 | Implement JWT storage | httpOnly cookies |
| 12.6 | Create logout function | Clear tokens |
| 12.7 | Test auth flow | Login → Dashboard |

### Phase 13: Frontend - Layout & Navigation

| Step | Task | Description |
|------|------|-------------|
| 13.1 | Create sidebar component | Collapsible sidebar |
| 13.2 | Create header component | User info, notifications |
| 13.3 | Create main layout | Responsive layout |
| 13.4 | Implement role-based menu | Show/hide based on role |
| 13.5 | Create breadcrumb | Navigation breadcrumb |
| 13.6 | Create notification bell | Real-time notifications |
| 13.7 | Mobile responsive | Hamburger menu |

### Phase 14: Frontend - Dashboard

| Step | Task | Description |
|------|------|-------------|
| 14.1 | Create dashboard page | Overview statistics |
| 14.2 | Create stat cards | Total employees, attendance, etc. |
| 14.3 | Create charts | Attendance chart, payroll chart |
| 14.4 | Create today's activity | Recent attendance |
| 14.5 | Create quick actions | Common shortcuts |

### Phase 15: Frontend - Attendance Pages

| Step | Task | Description |
|------|------|-------------|
| 15.1 | Create check-in page | GPS map + button |
| 15.2 | Implement GPS capture | Browser Geolocation API |
| 15.3 | Create map display | Leaflet map with radius |
| 15.4 | Create attendance history | Table with filters |
| 15.5 | Create attendance report | Charts and export |

### Phase 16: Frontend - Leave Pages

| Step | Task | Description |
|------|------|-------------|
| 16.1 | Create leave request form | Select type, dates, reason |
| 16.2 | Create leave history | Table with status |
| 16.3 | Create leave quota display | Remaining days |
| 16.4 | Create approval page | Manager view |
| 16.5 | Create leave calendar | Calendar view |

### Phase 17: Frontend - Payroll Pages

| Step | Task | Description |
|------|------|-------------|
| 17.1 | Create payroll process page | HR admin view |
| 17.2 | Create payslip page | Employee view |
| 17.3 | Create payslip download | PDF download button |
| 17.4 | Create BPJS report | Table + export |
| 17.5 | Create tax report | PPh 21 breakdown |
| 17.6 | Create cash advance page | Request + history |

### Phase 18: Frontend - Employee Management

| Step | Task | Description |
|------|------|-------------|
| 18.1 | Create employee list | Table with search, filter |
| 18.2 | Create add employee form | Multi-step form |
| 18.3 | Create edit employee form | Pre-filled form |
| 18.4 | Create employee profile | Profile card |
| 18.5 | Create department management | CRUD |
| 18.6 | Create position management | CRUD |
| 18.7 | Create location management | CRUD with map |

### Phase 19: Frontend - Social Pages

| Step | Task | Description |
|------|------|-------------|
| 19.1 | Create feed page | Posts list |
| 19.2 | Create post composer | Text + image |
| 19.3 | Create post card | Content, likes, comments |
| 19.4 | Create DM page | Chat interface |
| 19.5 | Create forum page | Categories, threads |
| 19.6 | Create announcements page | List of announcements |

### Phase 20: Frontend - Shift Pages

| Step | Task | Description |
|------|------|-------------|
| 20.1 | Create shift management page | CRUD shifts |
| 20.2 | Create shift calendar | Calendar with shift colors |
| 20.3 | Create shift assignment | Assign to employees |
| 20.4 | Create shift swap request | Employee view |

### Phase 21: Frontend - Reports & Statistics

| Step | Task | Description |
|------|------|-------------|
| 21.1 | Create attendance report page | Filter, chart, export |
| 21.2 | Create leave report page | Summary, export |
| 21.3 | Create overtime report page | Hours, cost, export |
| 21.4 | Create payroll summary | Department-wise |
| 21.5 | Create employee statistics | Demographics, trends |
| 21.6 | Implement PDF export | Generate PDF reports |
| 21.7 | Implement Excel export | Generate XLSX reports |

### Phase 22: Frontend - Settings

| Step | Task | Description |
|------|------|-------------|
| 22.1 | Create system settings page | Company info |
| 22.2 | Create BPJS config page | Rates configuration |
| 22.3 | Create tax config page | PPh 21 brackets |
| 22.4 | Create overtime rates page | Custom rates |
| 22.5 | Create leave config page | Leave types & quotas |
| 22.6 | Create user management page | Admin CRUD |
| 22.7 | Create audit logs page | Activity logs |

### Phase 23: Integration & Testing

| Step | Task | Description |
|------|------|-------------|
| 23.1 | Connect all services | API integration |
| 23.2 | Test auth flow | End-to-end login |
| 23.3 | Test attendance flow | GPS check-in/out |
| 23.4 | Test leave flow | Request → Approve |
| 23.5 | Test payroll flow | Process → Payslip |
| 23.6 | Test social features | Post, DM, Forum |
| 23.7 | Performance testing | Load testing |
| 23.8 | Security testing | Penetration testing |
| 23.9 | Bug fixing | Address issues |
| 23.10 | Documentation | API docs, user guide |

### Phase 24: Production Setup

| Step | Task | Description |
|------|------|-------------|
| 24.1 | Configure Nginx | Reverse proxy setup |
| 24.2 | Configure SSL | Let's Encrypt (optional) |
| 24.3 | Environment variables | Production config |
| 24.4 | Database backup | Automated backups |
| 24.5 | Logging setup | Centralized logging |
| 24.6 | Monitoring | Health checks |
| 24.7 | Docker Compose production | Final compose file |
| 24.8 | Deployment documentation | Step-by-step guide |

---

## 8. Docker Setup

### 8.1 docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
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

  # Redis Cache
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

  # Frontend - Next.js
  frontend:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: payrollpro-frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api-gateway:3001
      - NEXT_PUBLIC_WS_URL=ws://websocket:3002
    depends_on:
      api-gateway:
        condition: service_healthy

  # API Gateway
  api-gateway:
    build:
      context: .
      dockerfile: apps/api-gateway/Dockerfile
    container_name: payrollpro-api-gateway
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - AUTH_SERVICE_URL=http://auth-service:3010
      - EMPLOYEE_SERVICE_URL=http://employee-service:3011
      - PAYROLL_SERVICE_URL=http://payroll-service:3012
      - ATTENDANCE_SERVICE_URL=http://attendance-service:3013
      - LEAVE_SERVICE_URL=http://leave-service:3014
      - SOCIAL_SERVICE_URL=http://social-service:3015
      - SHIFT_SERVICE_URL=http://shift-service:3016
      - JWT_SECRET=your-super-secret-key
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # WebSocket Server
  websocket:
    build:
      context: .
      dockerfile: apps/websocket/Dockerfile
    container_name: payrollpro-websocket
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy

  # Auth Service
  auth-service:
    build:
      context: .
      dockerfile: apps/auth-service/Dockerfile
    container_name: payrollpro-auth-service
    ports:
      - "3010:3010"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/payrollpro
      - JWT_SECRET=your-super-secret-key
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy

  # Employee Service
  employee-service:
    build:
      context: .
      dockerfile: apps/employee-service/Dockerfile
    container_name: payrollpro-employee-service
    ports:
      - "3011:3011"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/payrollpro
    depends_on:
      postgres:
        condition: service_healthy

  # Payroll Service
  payroll-service:
    build:
      context: .
      dockerfile: apps/payroll-service/Dockerfile
    container_name: payrollpro-payroll-service
    ports:
      - "3012:3012"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/payrollpro
    depends_on:
      postgres:
        condition: service_healthy

  # Attendance Service
  attendance-service:
    build:
      context: .
      dockerfile: apps/attendance-service/Dockerfile
    container_name: payrollpro-attendance-service
    ports:
      - "3013:3013"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/payrollpro
    depends_on:
      postgres:
        condition: service_healthy

  # Leave Service
  leave-service:
    build:
      context: .
      dockerfile: apps/leave-service/Dockerfile
    container_name: payrollpro-leave-service
    ports:
      - "3014:3014"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/payrollpro
    depends_on:
      postgres:
        condition: service_healthy

  # Social Service
  social-service:
    build:
      context: .
      dockerfile: apps/social-service/Dockerfile
    container_name: payrollpro-social-service
    ports:
      - "3015:3015"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/payrollpro
    depends_on:
      postgres:
        condition: service_healthy

  # Shift Service
  shift-service:
    build:
      context: .
      dockerfile: apps/shift-service/Dockerfile
    container_name: payrollpro-shift-service
    ports:
      - "3016:3016"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/payrollpro
    depends_on:
      postgres:
        condition: service_healthy

  # Nginx Reverse Proxy (Production)
  nginx:
    image: nginx:alpine
    container_name: payrollpro-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - api-gateway

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: payrollpro-network
```

### 8.2 Dockerfile Example (Frontend)

```dockerfile
# apps/web/Dockerfile
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

### 8.3 Dockerfile Example (Backend Service)

```dockerfile
# apps/auth-service/Dockerfile
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER fastify

EXPOSE 3010

CMD ["node", "dist/index.js"]
```

---

## 9. API Documentation

### 9.1 Authentication API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |

### 9.2 Employee API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | Get all employees |
| GET | `/api/employees/:id` | Get employee by ID |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Delete employee |
| GET | `/api/departments` | Get all departments |
| POST | `/api/departments` | Create department |
| PUT | `/api/departments/:id` | Update department |
| GET | `/api/positions` | Get all positions |
| POST | `/api/positions` | Create position |
| GET | `/api/locations` | Get all work locations |
| POST | `/api/locations` | Create work location |

### 9.3 Attendance API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/check-in` | Check in with GPS |
| POST | `/api/attendance/check-out` | Check out with GPS |
| GET | `/api/attendance/history` | Get attendance history |
| GET | `/api/attendance/today` | Get today's attendance |
| GET | `/api/attendance/report` | Get attendance report |

### 9.4 Leave API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/leaves` | Request leave |
| GET | `/api/leaves` | Get leave history |
| GET | `/api/leaves/:id` | Get leave detail |
| PUT | `/api/leaves/:id/approve` | Approve leave |
| PUT | `/api/leaves/:id/reject` | Reject leave |
| GET | `/api/leaves/quota` | Get leave quota |
| GET | `/api/leaves/calendar` | Get leave calendar |

### 9.5 Payroll API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payrolls/process` | Process payroll |
| GET | `/api/payrolls` | Get payroll history |
| GET | `/api/payrolls/:id` | Get payroll detail |
| GET | `/api/payrolls/:id/slip` | Download payslip PDF |
| POST | `/api/cash-advances` | Request cash advance |
| GET | `/api/cash-advances` | Get cash advance history |
| PUT | `/api/cash-advances/:id/approve` | Approve cash advance |

### 9.6 Shift API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shifts` | Get all shifts |
| POST | `/api/shifts` | Create shift |
| PUT | `/api/shifts/:id` | Update shift |
| DELETE | `/api/shifts/:id` | Delete shift |
| POST | `/api/employee-shifts` | Assign shift |
| GET | `/api/shifts/calendar` | Get shift calendar |
| POST | `/api/shifts/swap` | Request shift swap |

### 9.7 Social API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | Get feed posts |
| POST | `/api/posts` | Create post |
| DELETE | `/api/posts/:id` | Delete post |
| POST | `/api/posts/:id/like` | Like/unlike post |
| GET | `/api/posts/:id/comments` | Get comments |
| POST | `/api/posts/:id/comments` | Add comment |
| GET | `/api/messages` | Get conversations |
| POST | `/api/messages` | Send message |
| GET | `/api/messages/:userId` | Get messages with user |
| GET | `/api/announcements` | Get announcements |
| POST | `/api/announcements` | Create announcement |

---

## 10. Security & Authentication

### 10.1 JWT Implementation

```
┌─────────────────────────────────────────────────────────┐
│                    JWT Token Flow                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. User Login                                          │
│     └── POST /api/auth/login                            │
│         ├── Validate credentials                        │
│         ├── Generate access token (15 min)              │
│         └── Generate refresh token (7 days)             │
│                                                          │
│  2. Access Protected Resource                           │
│     └── GET /api/resource                               │
│         ├── Header: Authorization: Bearer <token>       │
│         ├── Verify token signature                      │
│         ├── Check expiration                            │
│         └── Extract user_id, role                       │
│                                                          │
│  3. Token Refresh                                       │
│     └── POST /api/auth/refresh                          │
│         ├── Validate refresh token                      │
│         ├── Generate new access token                   │
│         └── Invalidate old refresh token                │
│                                                          │
│  4. Logout                                              │
│     └── POST /api/auth/logout                           │
│         ├── Invalidate refresh token                    │
│         └── Clear cookies                               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 10.2 Role-Based Access Control (RBAC)

```
┌─────────────────────────────────────────────────────────┐
│                    RBAC Middleware                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Request → JWT Verify → Extract Role → Check Permission │
│                                                          │
│  super_admin: * (all permissions)                       │
│  hr_admin: employee.*, payroll.*, leave.*, report.*     │
│  manager: team.*, leave.approve, overtime.approve       │
│  employee: self.*, attendance.*, leave.request          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 10.3 Security Measures

| Measure | Implementation |
|---------|----------------|
| Password Hashing | bcrypt with salt rounds 12 |
| JWT Expiration | Access: 15min, Refresh: 7 days |
| Rate Limiting | 100 requests per minute |
| CORS | Whitelist frontend origin |
| Input Validation | Zod schemas on all endpoints |
| SQL Injection | Drizzle ORM parameterized queries |
| XSS Protection | Content Security Policy headers |
| HTTPS | SSL/TLS in production |
| Helmet.js | Security headers |
| Audit Logs | Track all sensitive operations |

---

## Appendix A: Environment Variables

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3002
NEXT_PUBLIC_APP_NAME=PayrollPro
```

### Backend (.env)
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/payrollpro
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
```

---

## Appendix B: Project Structure

```
payrollpro/
├── apps/
│   ├── web/                          # Next.js Frontend
│   │   ├── app/                      # App Router
│   │   │   ├── (auth)/               # Auth routes
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/          # Dashboard routes
│   │   │   │   ├── attendance/
│   │   │   │   ├── leave/
│   │   │   │   ├── payroll/
│   │   │   │   ├── employees/
│   │   │   │   ├── social/
│   │   │   │   ├── shift/
│   │   │   │   ├── reports/
│   │   │   │   └── settings/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # Reusable UI components
│   │   │   ├── layout/               # Layout components
│   │   │   ├── attendance/           # Attendance components
│   │   │   ├── leave/                # Leave components
│   │   │   ├── payroll/              # Payroll components
│   │   │   ├── employee/             # Employee components
│   │   │   ├── social/               # Social components
│   │   │   └── shift/                # Shift components
│   │   ├── lib/                      # Utilities
│   │   ├── stores/                   # Zustand stores
│   │   ├── hooks/                    # Custom hooks
│   │   ├── types/                    # TypeScript types
│   │   └── public/                   # Static assets
│   │
│   ├── api-gateway/                  # API Gateway Service
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── auth-service/                 # Authentication Service
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── employee-service/             # Employee Management
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── payroll-service/              # Payroll Processing
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── attendance-service/           # Attendance & GPS
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── leave-service/                # Leave Management
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── social-service/               # Social & Communication
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── shift-service/                # Shift Management
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── websocket/                    # WebSocket Server
│       ├── src/
│       │   ├── handlers/
│       │   └── index.ts
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── shared-types/                 # Shared TypeScript types
│   │   ├── src/
│   │   └── package.json
│   ├── utils/                        # Shared utilities
│   │   ├── src/
│   │   └── package.json
│   └── db/                           # Database schema & migrations
│       ├── src/
│       │   ├── schema/               # Drizzle schemas
│       │   └── index.ts
│       ├── drizzle.config.ts
│       └── package.json
│
├── docker/
│   ├── postgres/
│   │   ├── Dockerfile
│   │   └── init.sql
│   ├── redis/
│   │   └── redis.conf
│   └── nginx/
│       ├── nginx.conf
│       └── ssl/
│
├── .gitignore
├── .env.example
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

**Document Version:** 1.0.0  
**Last Updated:** September 15, 2026  
**Author:** PayrollPro Development Team
