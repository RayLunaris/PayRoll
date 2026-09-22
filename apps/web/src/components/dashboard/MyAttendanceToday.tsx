'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight,
  LogOut,
  LogIn,
} from 'lucide-react';
import api from '@/lib/api';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  workType?: string;
}

interface CurrentShift {
  id: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  date?: string;
}

export default function MyAttendanceToday() {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [shift, setShift] = useState<CurrentShift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        const [attRes, shiftRes] = await Promise.all([
          api.get('/attendance/today').catch(() => ({ data: { data: null } })),
          api.get('/shifts/current').catch(() => ({ data: { data: null } })),
        ]);

        if (!active) return;
        setAttendance(attRes.data?.data ?? null);
        setShift(shiftRes.data?.data ?? null);
      } catch (err) {
        console.error('Failed to fetch today attendance or shift:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const formatTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return '-';
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) {
        return timeStr; // if it's already HH:mm
      }
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
      return timeStr;
    }
  };

  const isCheckedIn = Boolean(attendance?.checkIn);
  const isCheckedOut = Boolean(attendance?.checkOut);

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl shadow-card text-white p-6 mb-6">
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/20 rounded w-1/4" />
          <div className="h-10 bg-white/20 rounded w-1/2" />
          <div className="h-8 bg-white/20 rounded w-1/3" />
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Attendance status & shift info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm">
                Presensi Hari Ini
              </span>
              {shift && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/30 text-blue-100 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {shift.shiftName} ({shift.startTime} - {shift.endTime})
                </span>
              )}
            </div>

            <div>
              {isCheckedOut ? (
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-7 h-7 text-emerald-300" />
                    Presensi Hari Ini Selesai
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    Masuk: <span className="font-semibold text-white">{formatTime(attendance?.checkIn)}</span> • 
                    Pulang: <span className="font-semibold text-white">{formatTime(attendance?.checkOut)}</span>
                  </p>
                </div>
              ) : isCheckedIn ? (
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Clock className="w-7 h-7 text-yellow-300 animate-pulse" />
                    Sudah Masuk: {formatTime(attendance?.checkIn)}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    Anda sedang bekerja. Jangan lupa untuk melakukan check-out saat jam pulang.
                  </p>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <AlertCircle className="w-7 h-7 text-amber-300" />
                    Belum Check-in Hari Ini
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    {shift 
                      ? `Jadwal shift Anda hari ini adalah pukul ${shift.startTime} - ${shift.endTime} WIB.`
                      : 'Segera lakukan presensi kehadiran Anda untuk hari ini.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Primary Call to Action */}
          <div className="flex-shrink-0">
            {isCheckedOut ? (
              <Link
                href="/attendance/history"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all backdrop-blur-sm border border-white/20"
              >
                <span>Lihat Riwayat</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : isCheckedIn ? (
              <Link
                href="/attendance/check-in"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-gray-900 font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                <LogOut className="w-5 h-5" />
                <span>Check-out Sekarang</span>
              </Link>
            ) : (
              <Link
                href="/attendance/check-in"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-blue-50 text-blue-700 font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                <LogIn className="w-5 h-5 text-blue-600" />
                <span>Check-in Sekarang</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
