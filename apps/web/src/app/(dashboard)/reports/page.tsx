'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import Link from 'next/link';
import api from '@/lib/api';
import {
  BarChart3,
  Users,
  UserCheck,
  CalendarDays,
  Clock,
  FileText,
  CreditCard,
  TrendingUp,
  Download,
} from 'lucide-react';

interface AttendanceSummary {
  employeeId: string;
  presentDays: number;
  lateDays: number;
  totalOvertime: number;
}

interface LeaveCalendarRow {
  id: string;
  startDate: string;
  endDate: string;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin', 'manager'];
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function localDateString(d: Date): string {
  const yy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export default function ReportsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [presentThisMonth, setPresentThisMonth] = useState(0);
  const [onLeaveToday, setOnLeaveToday] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    void (async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const today = localDateString(now);

      try {
        const [empRes, attRes, leaveRes] = await Promise.all([
          api
            .get<{ pagination: { total: number } }>('/employees?page=1&limit=1')
            .catch(() => ({ data: { pagination: { total: 0 } } })),
          api
            .get<{ data: AttendanceSummary[] }>(
              `/attendance/report?month=${month}&year=${year}`,
            )
            .catch(() => ({ data: { data: [] } })),
          api
            .get<{ data: LeaveCalendarRow[] }>(
              `/leaves/calendar?month=${month}&year=${year}`,
            )
            .catch(() => ({ data: { data: [] } })),
        ]);

        const attendances = attRes.data.data || [];
        const leaves = leaveRes.data.data || [];

        setTotalEmployees(empRes.data.pagination.total);
        setPresentThisMonth(
          attendances.reduce((sum, row) => sum + Number(row.presentDays), 0),
        );
        setOvertimeHours(
          attendances.reduce((sum, row) => sum + Number(row.totalOvertime), 0),
        );
        setOnLeaveToday(
          leaves.filter((row) => row.startDate <= today && row.endDate >= today)
            .length,
        );
      } catch {
        // per-call catches above handle failures individually
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  const reportCards = [
    {
      title: 'Laporan Kehadiran',
      description: 'Rekap kehadiran, keterlambatan, dan lembur per karyawan',
      icon: Clock,
      href: '/reports/attendance',
    },
    {
      title: 'Laporan Penggajian',
      description: 'Rekap gaji, potongan, dan total biaya payroll',
      icon: CreditCard,
      href: '/reports/payroll',
    },
    {
      title: 'Laporan Lembur',
      description: 'Rekap jam dan biaya lembur per periode',
      icon: TrendingUp,
      href: '/reports/overtime',
    },
    {
      title: 'Statistik Karyawan',
      description: 'Distribusi karyawan berdasarkan departemen dan jabatan',
      icon: Users,
      href: '/reports/employee',
    },
  ];

  const statCards = [
    {
      label: 'Total Karyawan',
      value: loading ? '...' : totalEmployees,
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: `Kehadiran Bulan Ini (${MONTHS[new Date().getMonth()]})`,
      value: loading ? '...' : presentThisMonth,
      icon: UserCheck,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Cuti Hari Ini',
      value: loading ? '...' : onLeaveToday,
      icon: CalendarDays,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Lembur Bulan Ini',
      value: loading ? '...' : `${overtimeHours} jam`,
      icon: Clock,
      color: 'text-orange-600 bg-orange-50',
    },
  ];

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          Laporan &amp; Statistik
        </h1>
        <p className="text-gray-500 mt-1">
          Pantau kinerja dan aktivitas perusahaan
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className={`inline-flex p-3 rounded-lg mb-3 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Report cards */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Jenis Laporan</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {reportCards.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="card text-left hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
          >
            <div className="p-2.5 bg-blue-50 rounded-lg mb-3 inline-flex">
              <report.icon className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
            <p className="text-sm text-gray-500">{report.description}</p>
            <div className="mt-3 text-sm text-blue-600 font-medium flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Buka Laporan
            </div>
          </Link>
        ))}
      </div>

      <div className="card bg-blue-50">
        <div className="flex items-start gap-3 text-blue-700 text-sm">
          <Download className="h-5 w-5 shrink-0 mt-0.5" />
          <p>
            Setiap halaman laporan menyediakan tombol{' '}
            <strong>Export CSV</strong> untuk mengunduh data periode tersebut
            (dapat dibuka di Excel).
          </p>
        </div>
      </div>
    </div>
  );
}