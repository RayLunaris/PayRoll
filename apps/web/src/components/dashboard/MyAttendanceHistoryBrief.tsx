'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, ArrowRight, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface AttendanceItem {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: 'present' | 'late' | 'half_day' | 'absent' | 'leave' | 'holiday' | string;
}

const statusMap: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  present: { label: 'Hadir Tepat Waktu', bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
  late: { label: 'Terlambat', bg: 'bg-amber-50 border-amber-100', text: 'text-amber-700', icon: Clock },
  half_day: { label: 'Setengah Hari', bg: 'bg-blue-50 border-blue-100', text: 'text-blue-700', icon: AlertCircle },
  absent: { label: 'Tidak Hadir', bg: 'bg-red-50 border-red-100', text: 'text-red-700', icon: XCircle },
  leave: { label: 'Cuti / Izin', bg: 'bg-purple-50 border-purple-100', text: 'text-purple-700', icon: CalendarCheck },
  holiday: { label: 'Hari Libur', bg: 'bg-gray-50 border-gray-100', text: 'text-gray-600', icon: CalendarCheck },
};

function formatDayName(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatClock(timeStr: string | null | undefined): string {
  if (!timeStr) return '-';
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timeStr;
  }
}

export default function MyAttendanceHistoryBrief() {
  const [history, setHistory] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        // Fetch up to 7 recent attendance days
        const res = await api.get('/attendance/history');
        if (active && Array.isArray(res.data?.data)) {
          const list: AttendanceItem[] = res.data.data;
          // sort descending by date and take 7
          const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
          setHistory(sorted);
        }
      } catch (err) {
        console.error('Failed to load attendance history:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Riwayat Presensi Singkat</h3>
              <p className="text-xs text-gray-500">Aktivitas 7 hari terakhir</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2.5 my-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-gray-600">Belum ada catatan presensi</p>
            <p className="text-xs text-gray-400 mt-1">Presensi yang Anda lakukan akan tampil di sini</p>
          </div>
        ) : (
          <div className="space-y-2 my-2">
            {history.map((item) => {
              const info = statusMap[item.status] || {
                label: item.status,
                bg: 'bg-gray-50 border-gray-100',
                text: 'text-gray-700',
                icon: CheckCircle2,
              };
              const Icon = info.icon;

              return (
                <div
                  key={item.id || item.date}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${info.bg} text-xs`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${info.text}`} />
                    <span className="font-semibold text-gray-800">{formatDayName(item.date)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${info.text}`}>
                      {info.label}
                    </span>
                  </div>

                  <div className="text-right flex-shrink-0 text-gray-600">
                    <span>{formatClock(item.checkIn)}</span>
                    <span className="mx-1 text-gray-400">-</span>
                    <span>{formatClock(item.checkOut)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-400">Total 7 hari terakhir</span>
        <Link
          href="/attendance/history"
          className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 hover:underline"
        >
          <span>Lihat Riwayat Lengkap</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
