'use client';

import { useState, useEffect, useMemo } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  overtimeHours: string;
  checkInPhotoUrl?: string | null;
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
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const totalPages = Math.max(1, Math.ceil(history.length / pageSize));
  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return history.slice(start, start + pageSize);
  }, [history, page, pageSize]);

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
    setError('');
    setPage(1);
    try {
      const data = await loadAttendanceHistory(startDate, endDate);
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch attendance history:', err);
      setError('Gagal memuat data filter. Silakan coba lagi.');
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
                  paginatedHistory.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.date)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {record.checkInPhotoUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={record.checkInPhotoUrl}
                              alt="Selfie"
                              className="w-7 h-7 rounded-full object-cover border border-gray-300 shrink-0"
                              title="Foto Selfie Presensi"
                              width={28}
                              height={28}
                              loading="lazy"
                            />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          )}
                          <span>{record.checkIn ? formatTime(record.checkIn) : '-'}</span>
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

        {/* Pagination controls */}
        {!loading && history.length > pageSize && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <span>
              Menampilkan {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, history.length)} dari {history.length} catatan
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="btn btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                Sebelumnya
              </button>
              <span className="px-2 font-medium text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
                aria-label="Halaman berikutnya"
              >
                Berikutnya
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
