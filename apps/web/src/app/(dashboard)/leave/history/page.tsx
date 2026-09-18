'use client';

import { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import type { LeaveType } from '@/types';
import { Calendar, AlertCircle, CheckCircle2, Ban } from 'lucide-react';

interface LeaveRecord {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes?: string;
  createdAt: string;
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Cuti Sakit',
  maternity: 'Cuti Melahirkan',
  paternity: 'Cuti Ayah',
  special: 'Cuti Khusus',
  unpaid: 'Cuti Tanpa Gaji',
};

const STATUS_BADGES: Record<
  LeaveRecord['status'],
  { label: string; className: string }
> = {
  pending: { label: 'Menunggu', className: 'badge badge-warning' },
  approved: { label: 'Disetujui', className: 'badge badge-success' },
  rejected: { label: 'Ditolak', className: 'badge badge-danger' },
  cancelled: { label: 'Dibatalkan', className: 'badge badge-gray' },
};

function calculateDays(start: string, end: string): number {
  const startD = new Date(start);
  const endD = new Date(end);
  if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD < startD) return 0;
  return Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function LeaveHistoryPage() {
  const [history, setHistory] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: LeaveRecord[] }>('/leaves/history');
      setHistory(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch leave history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchHistory();
    })();
  }, [fetchHistory]);

  const handleCancelLeave = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan pengajuan cuti ini?')) {
      return;
    }

    setCancellingId(id);
    setActionMessage(null);

    try {
      await api.put(`/leaves/${id}/cancel`);
      setActionMessage({
        type: 'success',
        text: 'Pengajuan cuti berhasil dibatalkan.',
      });
      await fetchHistory();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setActionMessage({
        type: 'error',
        text:
          axiosErr.response?.data?.error ||
          'Gagal membatalkan pengajuan cuti. Silakan coba lagi.',
      });
    } finally {
      setCancellingId(null);
    }
  };

  const filteredHistory = history.filter((item) => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  return (
    <div>
      <Breadcrumb />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}


      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Cuti</h1>
          <p className="text-gray-500 mt-1">Daftar seluruh pengajuan cuti dan statusnya</p>
        </div>

        {/* Filter selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="statusFilter" className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Filter Status:
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-40"
          >
            <option value="all">Semua</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`mb-6 flex items-start gap-3 p-4 rounded-lg ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          )}
          <p className="text-sm font-medium">{actionMessage.text}</p>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Jenis Cuti</th>
                  <th>Periode</th>
                  <th>Durasi</th>
                  <th>Alasan</th>
                  <th>Catatan</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 && !error ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-500">
                      {statusFilter === 'all'
                        ? 'Belum ada riwayat pengajuan cuti.'
                        : 'Tidak ada pengajuan cuti dengan status ini.'}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((leave) => {
                    const days = calculateDays(leave.startDate, leave.endDate);
                    const badge = STATUS_BADGES[leave.status] || {
                      label: leave.status,
                      className: 'badge badge-gray',
                    };

                    return (
                      <tr key={leave.id}>
                        <td className="font-medium text-gray-900">
                          {LEAVE_TYPE_LABELS[leave.leaveType] || leave.leaveType}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-gray-700 whitespace-nowrap">
                            <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                            <span>
                              {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap font-medium text-gray-800">
                          {days} hari
                        </td>
                        <td className="max-w-xs truncate" title={leave.reason}>
                          {leave.reason || '-'}
                        </td>
                        <td className="max-w-xs truncate text-gray-500 text-xs" title={leave.notes}>
                          {leave.notes || '-'}
                        </td>
                        <td>
                          <span className={badge.className}>{badge.label}</span>
                        </td>
                        <td className="text-right">
                          {leave.status === 'pending' ? (
                            <button
                              onClick={() => handleCancelLeave(leave.id)}
                              disabled={cancellingId === leave.id}
                              className="btn btn-sm btn-secondary text-xs hover:text-red-600 inline-flex items-center gap-1"
                              title="Batalkan pengajuan cuti"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              {cancellingId === leave.id ? 'Memproses...' : 'Batalkan'}
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
