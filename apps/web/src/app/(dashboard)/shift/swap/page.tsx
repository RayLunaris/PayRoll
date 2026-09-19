'use client';

import { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import ShiftTabs from '@/components/shift/ShiftTabs';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error';
import {
  ArrowLeftRight,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  Loader2,
  AlertCircle,
  Send,
} from 'lucide-react';

interface Employee {
  id: string;
  nip: string;
  fullName: string;
  departmentId: string | null;
}

interface ShiftSwap {
  id: string;
  requesterId: string;
  targetId: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  createdAt: string;
  requesterName?: string;
  targetName?: string;
}

export default function ShiftSwapPage() {
  const user = useAuthStore((state) => state.user);
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState<'all' | 'incoming' | 'outgoing'>('all');

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [swapDate, setSwapDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchSwapsAndEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let queryParam = '';
      if (direction !== 'all') {
        queryParam = `?direction=${direction}`;
      }

      const canViewEmployees = Boolean(user && ['manager', 'hr_admin', 'super_admin'].includes(user.role));
      const [swapsRes, empRes] = await Promise.all([
        api.get<{ data: ShiftSwap[] }>(`/shifts/swap/requests${queryParam}`).catch(() => ({ data: { data: [] } })),
        canViewEmployees
          ? api.get<{ data: Employee[] }>('/employees?page=1&limit=200').catch(() => ({ data: { data: [] } }))
          : Promise.resolve({ data: { data: [] } }),
      ]);

      const empList = empRes.data.data || [];
      setEmployees(empList);

      const rawSwaps = swapsRes.data.data || [];
      const enriched = rawSwaps.map((s) => {
        const reqEmp = empList.find((e) => e.id === s.requesterId);
        const tgtEmp = empList.find((e) => e.id === s.targetId);
        return {
          ...s,
          requesterName: reqEmp?.fullName || 'Karyawan',
          targetName: tgtEmp?.fullName || 'Rekan Kerja',
        };
      });

      setSwaps(enriched);
    } catch (err) {
      console.error('Failed to load swap requests:', err);
      setError('Gagal memuat daftar permohonan tukar shift.');
    } finally {
      setLoading(false);
    }
  }, [direction, user]);

  useEffect(() => {
    // Deferred so state updates are not synchronous with the effect body.
    const timer = window.setTimeout(() => {
      void fetchSwapsAndEmployees();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSwapsAndEmployees]);

  const handleSubmitSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployeeId || !swapDate) return;

    setSubmitting(true);
    setFormError('');

    try {
      await api.post('/shifts/swap', {
        targetEmployeeId,
        date: swapDate,
      });

      setShowForm(false);
      setTargetEmployeeId('');
      setSwapDate('');
      await fetchSwapsAndEmployees();
    } catch (err) {
      console.error('Failed to submit swap:', err);
      setFormError(getApiErrorMessage(err, 'Gagal mengajukan tukar shift.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (swapId: string, approved: boolean) => {
    setProcessingId(swapId);
    try {
      await api.put(`/shifts/swap/${swapId}/approve`, {
        approved,
      });
      await fetchSwapsAndEmployees();
    } catch (err) {
      console.error('Failed to update swap status:', err);
      alert(getApiErrorMessage(err, 'Gagal memproses persetujuan tukar shift.'));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <ShiftTabs />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-blue-600" />
            Permohonan Tukar Shift (Shift Swap)
          </h1>
          <p className="text-gray-500 mt-1">
            Ajukan pergantian jadwal shift dengan rekan kerja pada tanggal tertentu.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Ajukan Tukar Shift
        </button>
      </div>

      {/* Form Submission Modal / Card */}
      {showForm && (
        <div className="card p-6 border-2 border-blue-200 bg-blue-50/20">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-600" />
            Form Pengajuan Tukar Shift
          </h2>

          <form onSubmit={handleSubmitSwap} className="space-y-4 max-w-xl">
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Pilih Rekan Kerja Tujuan
              </label>
              <select
                aria-label="Pilih Rekan Kerja Tujuan"
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                required
              >
                <option value="">-- Pilih Rekan Kerja --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.nip})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Pastikan Anda dan rekan kerja memiliki penugasan shift pada tanggal yang dipilih.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                Tanggal Shift yang Ditukar
              </label>
              <input
                type="date"
                value={swapDate}
                onChange={(e) => setSwapDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-outline text-sm"
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !targetEmployeeId || !swapDate}
                className="btn btn-primary flex items-center gap-1.5 text-sm"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Kirim Permohonan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Directions */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setDirection('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            direction === 'all'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Semua Permohonan
        </button>
        <button
          onClick={() => setDirection('incoming')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            direction === 'incoming'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Ditujukan ke Saya (Masuk)
        </button>
        <button
          onClick={() => setDirection('outgoing')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            direction === 'outgoing'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Diajukan oleh Saya (Keluar)
        </button>
      </div>

      {/* Swap Requests List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Memuat data tukar shift...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        ) : swaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <ArrowLeftRight className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-700">Belum ada permohonan tukar shift</p>
            <p className="text-xs text-gray-400 mt-1">
              Klik &quot;Ajukan Tukar Shift&quot; untuk mengajukan pertukaran jadwal kerja.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-700">
                <tr>
                  <th className="px-6 py-3">Tanggal Shift</th>
                  <th className="px-6 py-3">Pemohon</th>
                  <th className="px-6 py-3">Tujuan Pertukaran</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Waktu Pengajuan</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {swaps.map((s) => {
                  const isPending = s.status === 'pending';

                  return (
                    <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap">
                        {s.date}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{s.requesterName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{s.targetName}</span>
                      </td>
                      <td className="px-6 py-4">
                        {s.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3" />
                            Menunggu Persetujuan
                          </span>
                        )}
                        {s.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Disetujui
                          </span>
                        )}
                        {s.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                            <XCircle className="h-3 w-3" />
                            Ditolak
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {new Date(s.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleDecision(s.id, true)}
                              disabled={processingId === s.id}
                              className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Setujui
                            </button>
                            <button
                              onClick={() => handleDecision(s.id, false)}
                              disabled={processingId === s.id}
                              className="btn btn-xs bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Selesai</span>
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
