'use client';

import { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  Loader2,
  Trash2,
} from 'lucide-react';

interface OvertimeRequestItem {
  id: string;
  employeeId: string;
  date: string;
  hours: string | number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes?: string | null;
  createdAt: string;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_CONFIG: Record<
  OvertimeRequestItem['status'],
  { label: string; className: string; Icon: React.ElementType }
> = {
  pending: { label: 'Menunggu', className: 'badge badge-warning', Icon: Clock },
  approved: { label: 'Disetujui', className: 'badge badge-success', Icon: CheckCircle2 },
  rejected: { label: 'Ditolak', className: 'badge badge-danger', Icon: XCircle },
  cancelled: { label: 'Dibatalkan', className: 'badge bg-gray-100 text-gray-600', Icon: Ban },
};

export default function OvertimeHistoryPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [requests, setRequests] = useState<OvertimeRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: OvertimeRequestItem[] }>('/attendance/overtime-requests', {
        params: { month, year },
      });
      setRequests(res.data?.data || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const handleCancel = async (id: string) => {
    if (!confirm('Batalkan pengajuan lembur ini?')) return;
    setCancellingId(id);
    setFeedback(null);
    try {
      await api.delete(`/attendance/overtime-requests/${id}`);
      setFeedback({ type: 'success', text: 'Pengajuan berhasil dibatalkan.' });
      await fetchRequests();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setFeedback({ type: 'error', text: axiosErr.response?.data?.error || 'Gagal membatalkan pengajuan.' });
    } finally {
      setCancellingId(null);
    }
  };

  const YEARS = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Lembur</h1>
        <p className="text-gray-500 mt-1">Status pengajuan lembur Anda</p>
      </div>

      {/* Filter */}
      <div className="card mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Bulan:</label>
          <select
            id="hist-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="input py-1.5 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Tahun:</label>
          <select
            id="hist-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="input py-1.5 text-sm"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-5 flex items-start gap-3 p-4 rounded-lg ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          )}
          <p className="text-sm font-medium">{feedback.text}</p>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 space-y-2">
            <Clock className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="font-medium text-gray-700">Belum Ada Pengajuan</p>
            <p className="text-sm">Tidak ada pengajuan lembur di periode ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="pb-3 pr-4">Tanggal</th>
                  <th className="pb-3 pr-4">Jam</th>
                  <th className="pb-3 pr-4">Alasan</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Catatan</th>
                  <th className="pb-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req) => {
                  const sc = STATUS_CONFIG[req.status];
                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">
                        {formatDate(req.date)}
                      </td>
                      <td className="py-3 pr-4 text-gray-700">
                        {parseFloat(req.hours.toString())} jam
                      </td>
                      <td className="py-3 pr-4 text-gray-600 max-w-xs">
                        <span className="line-clamp-2">{req.reason}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`${sc.className} flex items-center gap-1 w-fit`}>
                          <sc.Icon className="h-3 w-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500 italic text-xs max-w-xs">
                        {req.notes || '—'}
                      </td>
                      <td className="py-3">
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(req.id)}
                            disabled={cancellingId === req.id}
                            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                            title="Batalkan pengajuan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {cancellingId === req.id ? 'Membatalkan...' : 'Batalkan'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
