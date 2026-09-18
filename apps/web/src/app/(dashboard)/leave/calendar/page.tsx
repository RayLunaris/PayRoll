'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Loader2,
  Calendar as CalendarIcon,
  Info,
} from 'lucide-react';

interface LeaveCalendarItem {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  employeeName?: string;
  employeeNip?: string;
  departmentName?: string;
}

interface Employee {
  id: string;
  nip: string;
  fullName: string;
  departmentId: string | null;
}

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const LEAVE_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; text: string }
> = {
  annual: {
    label: 'Cuti Tahunan',
    color: '#3B82F6',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
  },
  sick: {
    label: 'Cuti Sakit',
    color: '#EF4444',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
  },
  maternity: {
    label: 'Cuti Melahirkan',
    color: '#8B5CF6',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
  },
  paternity: {
    label: 'Cuti Ayah',
    color: '#10B981',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
  },
  special: {
    label: 'Cuti Khusus',
    color: '#F59E0B',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
  },
  unpaid: {
    label: 'Cuti Tanpa Gaji',
    color: '#6B7280',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
  },
};

export default function LeaveCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [leaves, setLeaves] = useState<LeaveCalendarItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState<LeaveCalendarItem | null>(null);

  const changeMonth = (delta: number) => {
    const current = new Date(year, month - 1 + delta, 1);
    setMonth(current.getMonth() + 1);
    setYear(current.getFullYear());
  };

  const resetToToday = () => {
    setMonth(today.getMonth() + 1);
    setYear(today.getFullYear());
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [leavesRes, empRes] = await Promise.all([
          api.get<{ data: LeaveCalendarItem[] }>(`/leaves/calendar?month=${month}&year=${year}`),
          api.get<{ data: Employee[] }>('/employees?page=1&limit=200').catch(() => ({ data: { data: [] } })),
        ]);

        const rawLeaves = leavesRes.data.data || [];
        const empList = empRes.data.data || [];
        setEmployees(empList);

        const enriched = rawLeaves.map((l) => {
          const emp = empList.find((e) => e.id === l.employeeId);
          return {
            ...l,
            employeeName: emp?.fullName || 'Karyawan',
            employeeNip: emp?.nip || '-',
          };
        });

        setLeaves(enriched);
      } catch (error) {
        console.error('Failed to fetch leave calendar:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [year, month]);

  // Calendar cell layout computation (Monday-start)
  const { cells, daysInMonth } = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysIn = new Date(year, month, 0).getDate();
    const total = Math.ceil((startOffset + daysIn) / 7) * 7;

    const list: (number | null)[] = [];
    for (let i = 0; i < total; i++) {
      const day = i - startOffset + 1;
      list.push(day >= 1 && day <= daysIn ? day : null);
    }

    return { cells: list, daysInMonth: daysIn };
  }, [year, month]);

  // Get leaves for a specific day
  const getLeavesForDay = (day: number) => {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.filter((l) => l.startDate <= dayStr && l.endDate >= dayStr);
  };

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() + 1 &&
      year === today.getFullYear()
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-600" />
            Kalender Cuti Karyawan
          </h1>
          <p className="text-gray-500 mt-1">
            Visualisasi jadwal cuti yang telah disetujui untuk koordinasi tim.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/leave/request" className="btn btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="h-4 w-4" />
            Ajukan Cuti
          </Link>
          <Link href="/leave/history" className="btn btn-outline text-sm">
            Riwayat Cuti
          </Link>
        </div>
      </div>

      {/* Navigation & Controls */}
      <div className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            aria-label="Bulan Sebelumnya"
            className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 min-w-[180px] text-center">
            {MONTHS[month - 1]} {year}
          </h2>
          <button
            onClick={() => changeMonth(1)}
            aria-label="Bulan Berikutnya"
            className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={resetToToday}
            className="ml-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Hari Ini
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          {Object.entries(LEAVE_TYPE_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full`} style={{ backgroundColor: config.color }} />
              <span>{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Memuat kalender cuti...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold uppercase text-gray-600 py-3">
                {WEEKDAYS.map((w, idx) => (
                  <div key={w} className={idx >= 5 ? 'text-rose-500' : ''}>
                    {w}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-gray-200 border-b border-gray-200">
                {cells.map((day, idx) => {
                  if (day === null) {
                    return <div key={idx} className="min-h-[105px] bg-gray-50/40 p-2" />;
                  }

                  const dayLeaves = getLeavesForDay(day);
                  const currentDay = isToday(day);

                  return (
                    <div
                      key={idx}
                      className={`min-h-[105px] p-2 transition-colors ${
                        currentDay ? 'bg-blue-50/30' : 'bg-white hover:bg-gray-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs font-semibold rounded-full flex items-center justify-center h-6 w-6 ${
                            currentDay
                              ? 'bg-blue-600 text-white'
                              : idx % 7 >= 5
                              ? 'text-rose-500'
                              : 'text-gray-700'
                          }`}
                        >
                          {day}
                        </span>
                        {dayLeaves.length > 0 && (
                          <span className="text-[10px] font-bold text-gray-400">
                            {dayLeaves.length} cuti
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayLeaves.slice(0, 3).map((l) => {
                          const config = LEAVE_TYPE_CONFIG[l.leaveType] || LEAVE_TYPE_CONFIG.annual;
                          return (
                            <button
                              key={l.id}
                              onClick={() => setSelectedLeave(l)}
                              className={`w-full text-left truncate text-[11px] font-medium px-1.5 py-0.5 rounded border ${config.bg} ${config.border} ${config.text} hover:opacity-80 transition-opacity`}
                            >
                              {l.employeeName}
                            </button>
                          );
                        })}
                        {dayLeaves.length > 3 && (
                          <div className="text-[10px] font-semibold text-gray-500 px-1">
                            +{dayLeaves.length - 3} lainnya
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leave Detail Modal */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 bg-white shadow-xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Detail Cuti Karyawan
              </h3>
              <button
                onClick={() => setSelectedLeave(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-gray-500">Nama Karyawan:</span>
                <p className="font-semibold text-gray-900">{selectedLeave.employeeName}</p>
                <p className="text-xs text-gray-400">NIP: {selectedLeave.employeeNip}</p>
              </div>

              <div>
                <span className="text-xs text-gray-500">Jenis Cuti:</span>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                      LEAVE_TYPE_CONFIG[selectedLeave.leaveType]?.bg || 'bg-gray-100'
                    } ${LEAVE_TYPE_CONFIG[selectedLeave.leaveType]?.border || 'border-gray-200'} ${
                      LEAVE_TYPE_CONFIG[selectedLeave.leaveType]?.text || 'text-gray-800'
                    }`}
                  >
                    {LEAVE_TYPE_CONFIG[selectedLeave.leaveType]?.label || selectedLeave.leaveType}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-gray-500">Periode Cuti:</span>
                <p className="font-medium text-gray-800">
                  {selectedLeave.startDate} s/d {selectedLeave.endDate}
                </p>
              </div>

              {selectedLeave.reason && (
                <div>
                  <span className="text-xs text-gray-500">Alasan:</span>
                  <p className="text-gray-700 bg-gray-50 p-2.5 rounded-lg text-xs mt-1">
                    {selectedLeave.reason}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLeave(null)}
                className="btn btn-outline text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
