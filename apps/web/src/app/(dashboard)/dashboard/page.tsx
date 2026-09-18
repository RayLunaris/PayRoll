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

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const isApprover = user && ['manager', 'hr_admin', 'super_admin'].includes(user.role);
        const [employees, attendance, approvals] = await Promise.all([
          api.get('/employees').catch(() => ({ data: { data: [] } })),
          api.get('/attendance/today').catch(() => ({ data: { data: null } })),
          isApprover
            ? api.get('/leaves/approvals').catch(() => ({ data: { data: [] } }))
            : Promise.resolve({ data: { data: [] } }),
        ]);

        if (!active) return;

        setStats({
          totalEmployees: employees?.data?.pagination?.total ?? employees?.data?.data?.length ?? 0,
          presentToday: attendance?.data?.data?.checkIn ? 1 : 0,
          onLeave: 0,
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
  }, []);

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
          value={loading ? '...' : stats.totalEmployees}
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
          value={loading ? '...' : stats.pendingApprovals}
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
