'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { Clock } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  overtimeHours: string;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  present: { label: 'Hadir', className: 'badge badge-success' },
  late: { label: 'Terlambat', className: 'badge badge-warning' },
  absent: { label: 'Absen', className: 'badge badge-danger' },
  half_day: { label: 'Setengah Hari', className: 'badge badge-info' },
  leave: { label: 'Cuti', className: 'badge badge-gray' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Fetches attendance history with optional date filters.
 * Extracted outside the component so it has no hook dependencies and
 * can be called both from useEffect and from a button handler without
 * triggering react-hooks/set-state-in-effect.
 */
async function loadAttendanceHistory(
  startDate: string,
  endDate: string,
): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const res = await api.get<{ data: AttendanceRecord[] }>(
    `/attendance/history?${params.toString()}`,
  );
  return res.data.data;
}

export default function AttendanceHistoryPage() {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Initial load on mount using void IIFE so setState is never called
  // synchronously in the effect body (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    void (async () => {
      try {
        const data = await loadAttendanceHistory('', '');
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch attendance history:', err);
        setError('Gagal memuat riwayat kehadiran. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleFilter = async () => {
    setLoading(true);
    try {
      const data = await loadAttendanceHistory(startDate, endDate);
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch attendance history:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumb />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}


      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Kehadiran</h1>
          <p className="text-gray-500 mt-1">Riwayat presensi dan jam kerja Anda</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="label">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          <button onClick={handleFilter} disabled={loading} className="btn btn-primary">
            Filter
          </button>
        </div>
      </div>

      {/* History table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Status</th>
                  <th>Lembur</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && !error ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      Tidak ada data kehadiran
                    </td>
                  </tr>
                ) : (
                  history.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.date)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {record.checkIn ? formatTime(record.checkIn) : '-'}
                        </div>
                      </td>
                      <td>{record.checkOut ? formatTime(record.checkOut) : '-'}</td>
                      <td>
                        <span
                          className={
                            STATUS_BADGES[record.status]?.className ?? 'badge badge-gray'
                          }
                        >
                          {STATUS_BADGES[record.status]?.label ?? record.status}
                        </span>
                      </td>
                      <td>
                        {parseFloat(record.overtimeHours) > 0
                          ? `${record.overtimeHours} jam`
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
