'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Breadcrumb from '@/components/layout/Breadcrumb';
import StatCard from '@/components/dashboard/StatCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import QuickActions from '@/components/dashboard/QuickActions';
import RecentAnnouncements from '@/components/dashboard/RecentAnnouncements';
import MyAttendanceToday from '@/components/dashboard/MyAttendanceToday';
import MyLeaveSummary from '@/components/dashboard/MyLeaveSummary';
import MyLatestSlip from '@/components/dashboard/MyLatestSlip';
import MyActiveCashAdvance from '@/components/dashboard/MyActiveCashAdvance';
import MyAttendanceHistoryBrief from '@/components/dashboard/MyAttendanceHistoryBrief';
import SocialFeedBrief from '@/components/dashboard/SocialFeedBrief';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import {
  Users,
  CalendarCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';

// Recharts (~400KB) is only needed when charts mount — keep it out of the dashboard first-load chunk.
function ChartSkeleton() {
  return (
    <div className="h-64 w-full flex items-center justify-center bg-gray-50/50 rounded-lg">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
    </div>
  );
}

const AttendanceChart = dynamic(
  () => import('@/components/dashboard/AttendanceChart'),
  { ssr: false, loading: ChartSkeleton },
);
const PayrollChart = dynamic(
  () => import('@/components/dashboard/PayrollChart'),
  { ssr: false, loading: ChartSkeleton },
);

interface ManagementStats {
  totalEmployees: number;
  presentToday: number;
  onLeave: number;
  pendingApprovals: number;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  const isAdmin = Boolean(role && ['super_admin', 'hr_admin', 'admin'].includes(role));
  const isManager = role === 'manager';
  const isEmployee = !isAdmin && !isManager;

  const [stats, setStats] = useState<ManagementStats>({
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    pendingApprovals: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [hasActiveCashAdvance, setHasActiveCashAdvance] = useState(false);

  useEffect(() => {
    if (!user || isEmployee) return;
    let active = true;

    void (async () => {
      setLoadingStats(true);
      try {
        // Fetch only the relevant endpoints based on role
        const promises: Promise<any>[] = [
          // 0: Present today
          api.get('/attendance/today-summary').catch(() => ({ data: { data: { presentCount: 0 } } })),
          // 1: On leave today
          api.get('/leaves/on-leave-today').catch(() => ({ data: { data: { onLeaveCount: 0 } } })),
          // 2: Pending approvals
          api.get('/leaves/approvals').catch(() => ({ data: { data: [] } })),
        ];

        // Only Admin queries /employees for company-wide headcount
        if (isAdmin) {
          promises.push(
            api.get('/employees').catch(() => ({ data: { data: [] } }))
          );
        }

        const results = await Promise.all(promises);
        if (!active) return;

        const todayAttendance = results[0];
        const onLeaveData = results[1];
        const approvals = results[2];
        const employees = isAdmin ? results[3] : null;

        setStats({
          totalEmployees: employees?.data?.pagination?.total ?? employees?.data?.data?.length ?? 0,
          presentToday: todayAttendance?.data?.data?.presentCount ?? 0,
          onLeave: onLeaveData?.data?.data?.onLeaveCount ?? 0,
          pendingApprovals: approvals?.data?.data?.length ?? 0,
        });
      } catch (err) {
        console.error('Failed to load management dashboard stats:', err);
      } finally {
        if (active) setLoadingStats(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user, isAdmin, isManager, isEmployee]);

  return (
    <div>
      <Breadcrumb />

      {/* Header with role-aware title & subtitle */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdmin
            ? 'Dashboard Perusahaan'
            : isManager
            ? 'Dashboard Tim & Departemen'
            : 'Dashboard Saya'}
        </h1>
        <p className="text-gray-500 mt-1">
          {isAdmin
            ? 'Ringkasan komprehensif kehadiran, perizinan, dan payroll seluruh perusahaan'
            : isManager
            ? 'Monitoring real-time kehadiran tim dan pengelolaan persetujuan perizinan divisi Anda'
            : `Selamat datang kembali, ${user?.email?.split('@')[0] || 'Karyawan'}. Pantau presensi dan administrasi mandiri Anda.`}
        </p>
      </div>

      {/* 1. Announcements Banner (Shown on top for ALL roles) */}
      <RecentAnnouncements />

      {/* 2. Role-specific Body */}
      {isAdmin && (
        <>
          {/* Admin Stat Cards: 4 cards company-wide */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard
              title="Total Karyawan"
              value={loadingStats ? '...' : String(stats.totalEmployees)}
              icon={<Users className="h-6 w-6" />}
              color="blue"
              subtitle="Karyawan aktif"
            />
            <StatCard
              title="Hadir Hari Ini"
              value={loadingStats ? '...' : String(stats.presentToday)}
              icon={<CalendarCheck className="h-6 w-6" />}
              color="green"
              subtitle="Presensi tercatat"
            />
            <StatCard
              title="Cuti Berjalan"
              value={loadingStats ? '...' : String(stats.onLeave)}
              icon={<Clock className="h-6 w-6" />}
              color="yellow"
              subtitle="Sedang izin / cuti"
            />
            <StatCard
              title="Menunggu Persetujuan"
              value={loadingStats ? '...' : String(stats.pendingApprovals)}
              icon={<AlertCircle className="h-6 w-6" />}
              color="red"
              subtitle="Perlu ditindaklanjuti"
            />
          </div>

          {/* Admin Charts: Company Attendance & Payroll Composition */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 card">
              <AttendanceChart />
            </div>
            <div className="card">
              <PayrollChart />
            </div>
          </div>

          {/* Admin Bottom Section: Activity & Admin Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
              <RecentActivity />
            </div>
            <div className="card">
              <QuickActions />
            </div>
          </div>
        </>
      )}

      {isManager && (
        <>
          {/* Manager Stat Cards: Exactly 3 cards scoped to team. (Total Karyawan is OMITTED) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <StatCard
              title="Hadir Hari Ini"
              value={loadingStats ? '...' : String(stats.presentToday)}
              icon={<CalendarCheck className="h-6 w-6" />}
              color="green"
              subtitle="Anggota tim hadir"
            />
            <StatCard
              title="Cuti Berjalan"
              value={loadingStats ? '...' : String(stats.onLeave)}
              icon={<Clock className="h-6 w-6" />}
              color="yellow"
              subtitle="Tim sedang cuti"
            />
            <StatCard
              title="Menunggu Persetujuan"
              value={loadingStats ? '...' : String(stats.pendingApprovals)}
              icon={<AlertCircle className="h-6 w-6" />}
              color="red"
              subtitle="Pengajuan tim tertunda"
            />
          </div>

          {/* Manager Chart: Team Weekly Attendance only. (PayrollChart is OMITTED) */}
          <div className="card mb-6">
            <AttendanceChart />
          </div>

          {/* Manager Bottom Section: Team Activity & Manager Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
              <RecentActivity />
            </div>
            <div className="card">
              <QuickActions />
            </div>
          </div>
        </>
      )}

      {isEmployee && (
        <>
          {/* Employee Hero: Today Attendance Status & Shift Schedule & Check-in/out CTA */}
          <MyAttendanceToday />

          {/* Employee Administration Grid: Leave Summary, Latest Slip, and Active Cash Advance (if any) */}
          <div
            className={`grid grid-cols-1 ${
              hasActiveCashAdvance ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2'
            } gap-6 mb-6`}
          >
            <MyLeaveSummary />
            <MyLatestSlip />
            <MyActiveCashAdvance onStatusLoaded={setHasActiveCashAdvance} />
          </div>

          {/* Employee History & Social: 7-day attendance history & company feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <MyAttendanceHistoryBrief />
            <SocialFeedBrief />
          </div>

          {/* Employee Bottom Section: Personal Activity & Personal Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
              <RecentActivity />
            </div>
            <div className="card">
              <QuickActions />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
