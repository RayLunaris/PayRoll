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
  code?: string;
  description?: string;
  baseSalary: number;
  grade?: string;
  levelRank?: number;
  minSalary?: number;
  maxSalary?: number;
  positionAllowance?: number;
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

export interface EmployeeShift {
  id: string;
  employeeId: string;
  shiftId: string;
  date: string;
  createdAt?: Date;
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

export interface LeaveQuota {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  year: number;
  totalQuota: number;
  usedQuota: number;
  createdAt?: Date;
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

export interface SocialComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface SocialLike {
  id: string;
  postId: string;
  userId: string;
  createdAt: Date;
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

// Timezone Utilities (WIB - UTC+7 / Asia/Jakarta)
export function getWIBDate(date: Date = new Date()): Date {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (7 * 3600000));
}

export function getWIBDateString(date: Date = new Date()): string {
  const wib = getWIBDate(date);
  const y = wib.getFullYear();
  const m = String(wib.getMonth() + 1).padStart(2, '0');
  const d = String(wib.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWIBTimeString(date: Date = new Date()): string {
  const wib = getWIBDate(date);
  const h = String(wib.getHours()).padStart(2, '0');
  const min = String(wib.getMinutes()).padStart(2, '0');
  const s = String(wib.getSeconds()).padStart(2, '0');
  return `${h}:${min}:${s}`;
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Position Salary Audit Log Types
export interface PositionSalaryAuditLog {
  id: string;
  positionId: string;
  changedByUserId: string;
  oldBaseSalary: number;
  newBaseSalary: number;
  oldAllowance?: number;
  newAllowance?: number;
  reason: string;
  createdAt: Date;
}

// Budget Types
export interface Budget {
  id: string;
  name: string;
  periodYear: number;
  periodMonth?: number | null;
  category: 'payroll' | 'project' | 'department' | 'general';
  departmentId?: string | null;
  allocatedAmount: number;
  spentAmount: number;
  notes?: string | null;
  status: 'draft' | 'active' | 'closed' | 'exceeded';
  createdAt: Date;
  updatedAt: Date;
}

// Project Types
export interface Project {
  id: string;
  code: string;
  name: string;
  clientName?: string | null;
  managerUserId?: string | null;
  totalBudget: number;
  laborBudget: number;
  operationalBudget: number;
  spentLabor: number;
  spentOperational: number;
  startDate: string | Date;
  endDate?: string | Date | null;
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  employeeId: string;
  roleInProject: string;
  allocationPercentage: number;
  assignedMonthlyCost: number;
  startDate: string | Date;
  endDate?: string | Date | null;
  createdAt: Date;
}

export interface ProjectExpense {
  id: string;
  projectId: string;
  expenseTitle: string;
  category: 'cloud_server' | 'license' | 'travel' | 'equipment' | 'other';
  amount: number;
  expenseDate: string | Date;
  receiptUrl?: string | null;
  submittedByUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export * from './activity.js';


