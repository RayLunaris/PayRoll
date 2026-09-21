'use client';

import { useEffect, useState } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import StatCard from '@/components/dashboard/StatCard';
import AttendanceChart from '@/components/dashboard/AttendanceChart';
import PayrollChart from '@/components/dashboard/PayrollChart';
import RecentActivity from '@/components/dashboard/RecentActivity';
import QuickActions from '@/components/dashboard/QuickActions';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import {
  Users,
  CalendarCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  onLeave: number;
  pendingApprovals: number;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    pendingApprovals: 0,
  });
  const [loading, setLoading] = useState(true);

  const isManagement = Boolean(user && ['manager', 'hr_admin', 'super_admin'].includes(user.role));
  const isApprover = Boolean(user && ['manager', 'hr_admin', 'super_admin'].includes(user.role));

  useEffect(() => {
    if (!user) return;
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        const canViewEmployees = isManagement;
        const canApprove = isApprover;

        const [employees, todayAttendance, onLeaveData, approvals] = await Promise.all([
          canViewEmployees
            ? api.get('/employees').catch(() => ({ data: { data: [] } }))
            : Promise.resolve({ data: { data: [] } }),
          api.get('/attendance/today-summary').catch(() => ({ data: { data: { presentCount: 0, isSelfCheckedIn: false } } })),
          api.get('/leaves/on-leave-today').catch(() => ({ data: { data: { onLeaveCount: 0, isSelfOnLeave: false } } })),
          canApprove
            ? api.get('/leaves/approvals').catch(() => ({ data: { data: [] } }))
            : Promise.resolve({ data: { data: [] } }),
        ]);

        if (!active) return;

        setStats({
          totalEmployees: employees?.data?.pagination?.total ?? employees?.data?.data?.length ?? 0,
          presentToday: isManagement
            ? (todayAttendance?.data?.data?.presentCount ?? 0)
            : (todayAttendance?.data?.data?.isSelfCheckedIn ? 1 : 0),
          onLeave: isManagement
            ? (onLeaveData?.data?.data?.onLeaveCount ?? 0)
            : (onLeaveData?.data?.data?.isSelfOnLeave ? 1 : 0),
          pendingApprovals: approvals?.data?.data?.length ?? 0,
        });
      } catch {
        // individual catches above already handle per-call failures
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user, isManagement, isApprover]);

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Ringkasan aktivitas dan statistik perusahaan hari ini
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Karyawan"
          value={loading ? '...' : isManagement ? stats.totalEmployees : '-'}
          icon={<Users className="h-6 w-6" />}
          color="blue"
        />
        <StatCard
          title="Hadir Hari Ini"
          value={loading ? '...' : stats.presentToday}
          icon={<CalendarCheck className="h-6 w-6" />}
          color="green"
        />
        <StatCard
          title="Cuti Berjalan"
          value={loading ? '...' : stats.onLeave}
          icon={<Clock className="h-6 w-6" />}
          color="yellow"
        />
        <StatCard
          title="Menunggu Persetujuan"
          value={loading ? '...' : isApprover ? stats.pendingApprovals : '-'}
          icon={<AlertCircle className="h-6 w-6" />}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 card">
          <AttendanceChart />
        </div>
        <div className="card">
          <PayrollChart />
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <RecentActivity />
        </div>
        <div className="card">
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
