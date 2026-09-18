'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { getApiErrorStatus } from '@/lib/error';
import type { LeaveType, LeaveQuota } from '@/types';
import {
  CalendarDays,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

const leaveSchema = z
  .object({
    leaveType: z.enum(
      ['annual', 'sick', 'maternity', 'paternity', 'special', 'unpaid'] as const,
      {
        required_error: 'Pilih tipe cuti',
      },
    ),
    startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
    endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
    reason: z.string().min(10, 'Alasan cuti minimal 10 karakter'),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return data.endDate >= data.startDate;
    },
    {
      message: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai',
      path: ['endDate'],
    },
  );

type LeaveFormData = z.infer<typeof leaveSchema>;

interface LeaveTypeConfig {
  value: LeaveType;
  label: string;
  defaultQuota: number;
}

export const LEAVE_TYPES: LeaveTypeConfig[] = [
  { value: 'annual', label: 'Cuti Tahunan', defaultQuota: 12 },
  { value: 'sick', label: 'Cuti Sakit', defaultQuota: 12 },
  { value: 'maternity', label: 'Cuti Melahirkan', defaultQuota: 90 },
  { value: 'paternity', label: 'Cuti Ayah', defaultQuota: 3 },
  { value: 'special', label: 'Cuti Khusus', defaultQuota: 0 },
  { value: 'unpaid', label: 'Cuti Tanpa Gaji', defaultQuota: 0 },
];

function calculateDays(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const startD = new Date(start);
  const endD = new Date(end);
  if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD < startD) return 0;
  return Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function LeaveRequestPage() {
  const [quotaMap, setQuotaMap] = useState<Record<string, LeaveQuota>>({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<LeaveFormData>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leaveType: 'annual',
      startDate: '',
      endDate: '',
      reason: '',
    },
  });

  const selectedType = useWatch({ control, name: 'leaveType' });
  const startDate = useWatch({ control, name: 'startDate' });
  const endDate = useWatch({ control, name: 'endDate' });

  const fetchQuota = useCallback(async () => {
    try {
      const response = await api.get<{ data: LeaveQuota[] }>('/leaves/quota');
      if (response.data.data) {
        const map: Record<string, LeaveQuota> = {};
        response.data.data.forEach((q) => {
          map[q.leaveType] = q;
        });
        setQuotaMap(map);
      }
    } catch (err) {
      if (getApiErrorStatus(err) !== 404) {
        console.error('Failed to fetch quota:', err);
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchQuota();
    })();
  }, [fetchQuota]);

  const days = calculateDays(startDate, endDate);
  const currentYear = new Date().getFullYear();

  // Determine available quota for selected leave type
  const selectedQuota = selectedType ? quotaMap[selectedType] : null;
  const typeConfig = LEAVE_TYPES.find((t) => t.value === selectedType);
  const totalQuota = selectedQuota?.totalQuota ?? (typeConfig?.defaultQuota || 0);
  const usedQuota = selectedQuota?.usedQuota ?? 0;
  const isUnlimited = selectedType === 'special' || selectedType === 'unpaid';
  const availableQuota = isUnlimited ? Infinity : Math.max(0, totalQuota - usedQuota);
  const isExceedingQuota = !isUnlimited && days > availableQuota;

  const onSubmit = async (data: LeaveFormData) => {
    if (isExceedingQuota) {
      setError(
        `Pengajuan ${days} hari melebihi sisa kuota yang tersedia (${availableQuota} hari).`,
      );
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/leaves', {
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
      });

      setSuccess('Pengajuan cuti berhasil dikirim! Menunggu persetujuan manager.');
      reset({
        leaveType: 'annual',
        startDate: '',
        endDate: '',
        reason: '',
      });

      // Refresh quota after submission
      await fetchQuota();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string; details?: unknown[] } };
      };
      const message =
        axiosErr.response?.data?.error ||
        'Terjadi kesalahan saat mengajukan cuti. Silakan coba lagi.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pengajuan Cuti</h1>
        <p className="text-gray-500 mt-1">Ajukan cuti dan pantau kuota tahunan Anda</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-2 card">
          {success && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-emerald-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Berhasil</p>
                <p className="text-xs text-emerald-600 mt-1">{success}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Gagal Mengajukan</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="leaveType" className="label">
                Tipe Cuti
              </label>
              <select id="leaveType" {...register('leaveType')} className="input">
                {LEAVE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {errors.leaveType && (
                <p className="mt-1 text-sm text-red-600">{errors.leaveType.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="label">
                  Tanggal Mulai
                </label>
                <input
                  id="startDate"
                  type="date"
                  {...register('startDate')}
                  className="input"
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="endDate" className="label">
                  Tanggal Selesai
                </label>
                <input
                  id="endDate"
                  type="date"
                  {...register('endDate')}
                  className="input"
                />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="reason" className="label">
                Alasan Pengajuan
              </label>
              <textarea
                id="reason"
                {...register('reason')}
                rows={4}
                className="input"
                placeholder="Jelaskan alasan pengajuan cuti minimal 10 karakter..."
              />
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
              )}
            </div>

            {isExceedingQuota && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Kuota tidak mencukupi</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Permintaan {days} hari melebihi sisa kuota Anda ({availableQuota} hari).
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isExceedingQuota}
              className="btn btn-primary w-full py-3"
            >
              {loading ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Cuti'}
            </button>
          </form>
        </div>

        {/* Quota Sidebar Column */}
        <div className="card h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            Kuota Cuti {currentYear}
          </h3>

          <div className="space-y-4">
            {LEAVE_TYPES.map((type) => {
              if (type.value === 'special' || type.value === 'unpaid') {
                return null;
              }

              const q = quotaMap[type.value];
              const total = q?.totalQuota ?? type.defaultQuota;
              const used = q?.usedQuota ?? 0;
              const remaining = Math.max(0, total - used);
              const percentage = total > 0 ? (used / total) * 100 : 0;

              return (
                <div key={type.value} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{type.label}</span>
                    <span className="text-xs font-semibold text-gray-500">
                      {remaining} / {total} hari
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        percentage > 80
                          ? 'bg-red-500'
                          : percentage > 50
                            ? 'bg-yellow-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
            <p className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span>Cuti Khusus & Cuti Tanpa Gaji tidak memotong kuota tahunan.</span>
            </p>
          </div>

          {days > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="text-center">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                  Total Hari Pengajuan
                </p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{days} hari</p>
                {!isUnlimited && (
                  <p
                    className={`text-xs mt-2 ${
                      days > availableQuota ? 'text-red-600 font-medium' : 'text-blue-600'
                    }`}
                  >
                    {days > availableQuota
                      ? `Kuota tidak cukup! Sisa kuota: ${availableQuota} hari`
                      : `Sisa kuota setelah disetujui: ${availableQuota - days} hari`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
