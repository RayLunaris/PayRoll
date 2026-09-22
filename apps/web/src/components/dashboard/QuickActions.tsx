'use client';

import Link from 'next/link';
import {
  CalendarCheck,
  CalendarDays,
  Wallet,
  Users,
  MessageCircle,
  FileText,
  Clock,
  Megaphone,
  CreditCard,
  UserCheck,
  UserCog,
  CheckSquare,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

interface QuickActionItem {
  label: string;
  href: string;
  icon: any;
  color?: string;
  badge?: string;
}

export default function QuickActions() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  const isAdmin = Boolean(role && ['super_admin', 'hr_admin', 'admin'].includes(role));
  const isManager = role === 'manager';

  let actions: QuickActionItem[] = [];

  if (isAdmin) {
    actions = [
      { label: 'Proses Payroll', href: '/payroll/process', icon: CreditCard, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' },
      { label: 'Kirim Pengumuman', href: '/social/announcements', icon: Megaphone, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
      { label: 'Karyawan', href: '/employees', icon: Users, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
      { label: 'Kelola User', href: '/settings/users', icon: UserCog, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
      { label: 'Check-in', href: '/attendance/check-in', icon: CalendarCheck },
      { label: 'Ajukan Cuti', href: '/leave/request', icon: CalendarDays },
      { label: 'Slip Gaji', href: '/payroll/slips', icon: FileText },
      { label: 'Kasbon', href: '/payroll/cash-advances', icon: Wallet },
    ];
  } else if (isManager) {
    actions = [
      { label: 'Approval Cuti', href: '/leave/approvals', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
      { label: 'Approval Kasbon', href: '/payroll/cash-advances', icon: CheckSquare, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
      { label: 'Approval Lembur', href: '/overtime/approvals', icon: Clock, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
      { label: 'Check-in', href: '/attendance/check-in', icon: CalendarCheck },
      { label: 'Ajukan Cuti', href: '/leave/request', icon: CalendarDays },
      { label: 'Slip Gaji', href: '/payroll/slips', icon: FileText },
      { label: 'Kasbon', href: '/payroll/cash-advances', icon: Wallet },
      { label: 'Sosial', href: '/social/feed', icon: MessageCircle },
    ];
  } else {
    // Karyawan (Employee)
    actions = [
      { label: 'Check-in', href: '/attendance/check-in', icon: CalendarCheck, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
      { label: 'Ajukan Cuti', href: '/leave/request', icon: CalendarDays, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
      { label: 'Slip Gaji', href: '/payroll/slips', icon: FileText, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
      { label: 'Kasbon', href: '/payroll/cash-advances', icon: Wallet, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
      { label: 'Lembur', href: '/overtime', icon: Clock, color: 'text-rose-600 bg-rose-50 hover:bg-rose-100' },
      { label: 'Sosial', href: '/social/feed', icon: MessageCircle, color: 'text-pink-600 bg-pink-50 hover:bg-pink-100' },
    ];
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Aksi Cepat
        </h3>
        <span className="text-xs text-gray-400 font-medium capitalize">
          {isAdmin ? 'Akses Admin' : isManager ? 'Akses Manager' : 'Menu Mandiri'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const styleClass = action.color ?? 'text-gray-700 bg-gray-50 hover:bg-blue-50 hover:text-blue-600';
          return (
            <Link
              key={action.label + action.href}
              href={action.href}
              className={`flex flex-col items-center gap-2 p-3.5 rounded-xl transition-all ${styleClass}`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs font-semibold text-center leading-tight">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}