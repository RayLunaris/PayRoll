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
