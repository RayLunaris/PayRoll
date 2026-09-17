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
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types';

type ActionRole = UserRole | '*';

interface QuickAction {
  label: string;
  href: string;
  icon: typeof CalendarCheck;
  roles: ActionRole[];
}

const actions: QuickAction[] = [
  { label: 'Check-in', href: '/attendance/check-in', icon: CalendarCheck, roles: ['*'] },
  { label: 'Ajukan Cuti', href: '/leave/request', icon: CalendarDays, roles: ['*'] },
  { label: 'Slip Gaji', href: '/payroll/slips', icon: FileText, roles: ['*'] },
  { label: 'Kasbon', href: '/payroll/cash-advances', icon: Wallet, roles: ['*'] },
  { label: 'Karyawan', href: '/employees', icon: Users, roles: ['hr_admin', 'super_admin'] },
  { label: 'Pengumuman', href: '/social/announcements', icon: Megaphone, roles: ['hr_admin', 'super_admin'] },
  { label: 'Lembur', href: '/overtime', icon: Clock, roles: ['*'] },
  { label: 'Sosial', href: '/social/feed', icon: MessageCircle, roles: ['*'] },
];

export default function QuickActions() {
  const user = useAuthStore((state) => state.user);

  const visibleActions = actions.filter((action) =>
    user !== null &&
    (action.roles.includes('*') || action.roles.includes(user.role))
  );

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Aksi Cepat
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <div className="text-gray-600">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}