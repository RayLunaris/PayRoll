'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { getApiErrorStatus } from '@/lib/error';
import { useAuthStore } from '@/stores/auth';
import type { CashAdvance, Employee } from '@/types';
import {
  Wallet,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const STATUS_BADGES: Record<
  CashAdvance['status'],
  { label: string; className: string }
> = {
  pending: { label: 'Menunggu', className: 'badge badge-warning' },
  approved: { label: 'Disetujui', className: 'badge badge-success' },
  rejected: { label: 'Ditolak', className: 'badge badge-danger' },
  deducted: { label: 'Terpotong', className: 'badge badge-info' },
};

const advanceSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'Jumlah wajib diisi' })
    .positive('Jumlah harus lebih dari 0'),
  reason: z
    .string()
    .min(10, 'Alasan kasbon minimal 10 karakter'),
  maxAmount: z.number().optional(),
});

type AdvanceForm = z.infer<typeof advanceSchema>;

const advanceResolver = zodResolver(
  advanceSchema.refine(
    (data) => {
      if (!data.maxAmount || data.maxAmount <= 0) return true;
      return data.amount <= data.maxAmount;
    },
    {
      message: 'Jumlah melebihi batas maksimal kasbon (25% dari gaji)',
      path: ['amount'],
    },
  ),
);

const DEFAULT_MAX_AMOUNT = 2000000;
const MAX_LIMIT_PERCENT = 0.25;

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

export default function CashAdvancesPage() {
  const user = useAuthStore((state) => state.user);
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [maxAmount, setMaxAmount] = useState(DEFAULT_MAX_AMOUNT);
  const [maxAmountStatus, setMaxAmountStatus] = useState<
    'loading' | 'loaded' | 'unknown'
  >('loading');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AdvanceForm>({
    resolver: advanceResolver,
    defaultValues: {
      amount: undefined,
      reason: '',
      maxAmount: DEFAULT_MAX_AMOUNT,
    },
  });

  const maxAmountHiddenField = register('maxAmount');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: CashAdvance[] }>(
        '/cash-advances/history',
      );
      setAdvances(response.data.data || []);
    } catch (err) {
      if (getApiErrorStatus(err) === 404) {
        setAdvances([]);
      } else {
        console.error('Failed to fetch cash advances:', err);
        setError('Gagal memuat data kasbon. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMaxAmount = useCallback(async () => {
    try {
      // Prioritize /employees/me, falling back to /employees/${user?.employeeId}
      let response;
      try {
        response = await api.get<{ data: Employee }>('/employees/me');
      } catch {
        if (user?.employeeId) {
          response = await api.get<{ data: Employee }>(`/employees/${user.employeeId}`);
        } else {
          setMaxAmountStatus('unknown');
          return;
        }
      }

      const baseSalary = Number(response.data.data?.baseSalary || 0);
      if (baseSalary > 0) {
        const limit = Math.round(baseSalary * MAX_LIMIT_PERCENT);
        setMaxAmount(limit);
        setValue('maxAmount', limit, {
          shouldValidate: false,
          shouldDirty: false,
        });
        setMaxAmountStatus('loaded');
      } else {
        setMaxAmountStatus('unknown');
      }
    } catch (err) {
      const status = getApiErrorStatus(err);
      if (status !== 403 && status !== 404) {
        console.error('Failed to fetch salary for cash advance limit:', err);
      }
      setMaxAmountStatus('unknown');
    }
  }, [user?.employeeId, setValue]);

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchHistory(), fetchMaxAmount()]);
    })();
  }, [fetchHistory, fetchMaxAmount]);

  const onSubmit = async (data: AdvanceForm) => {
    if (data.maxAmount && data.maxAmount > 0 && data.amount > data.maxAmount) {
      setError(
        `Jumlah melebihi batas maksimal kasbon (${formatRupiah(data.maxAmount)})`,
      );
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/cash-advances', {
        amount: data.amount,
        reason: data.reason,
      });
      setSuccess('Pengajuan kasbon berhasil dikirim dan menunggu persetujuan.');
      reset({
        amount: undefined,
        reason: '',
        maxAmount: data.maxAmount,
      });
      await fetchHistory();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error ||
          'Terjadi kesalahan saat mengajukan kasbon. Silakan coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kasbon Karyawan</h1>
        <p className="text-gray-500 mt-1">
          Pengajuan pinjaman gaji (maksimal 25% dari gaji)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request form */}
        <div className="lg:col-span-1 card h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            Ajukan Kasbon
          </h3>

          {success && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-emerald-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-700">{success}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 rounded-lg">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {maxAmountStatus === 'loading'
                    ? 'Menghitung batas maksimal kasbon...'
                    : maxAmountStatus === 'unknown'
                      ? 'Batas maksimal tidak dapat dihitung. Gunakan angka yang wajar (backend tetap memvalidasi).'
                      : `Maksimal pengajuan: ${formatRupiah(maxAmount)} (25% dari gaji)`}
                </span>
              </p>
            </div>

            <div>
              <label htmlFor="amount" className="label">
                Jumlah (Rp)
              </label>
              <input
                id="amount"
                type="number"
                min={1}
                step="any"
                inputMode="numeric"
                className="input"
                placeholder="500000"
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
              )}
            </div>

            <input type="hidden" {...maxAmountHiddenField} />

            <div>
              <label htmlFor="reason" className="label">
                Alasan
              </label>
              <textarea
                id="reason"
                {...register('reason')}
                rows={3}
                className="input"
                placeholder="Jelaskan kebutuhan kasbon (minimal 10 karakter)..."
              />
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || maxAmountStatus === 'loading'}
              className="btn btn-primary w-full py-3"
            >
              {submitting ? 'Mengirim...' : 'Ajukan Kasbon'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Riwayat Kasbon
          </h3>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : advances.length === 0 && !error ? (
            <div className="text-center py-12 text-gray-500 space-y-2">
              <Wallet className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="font-medium text-gray-700">Belum Ada Pengajuan Kasbon</p>
              <p className="text-sm">
                Pengajuan kasbon yang Anda kirim akan tampil di sini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Jumlah</th>
                    <th>Alasan</th>
                    <th>Periode</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map((advance) => {
                    const badge = STATUS_BADGES[advance.status] || {
                      label: advance.status,
                      className: 'badge badge-gray',
                    };

                    return (
                      <tr key={advance.id}>
                        <td className="font-medium text-gray-900 whitespace-nowrap">
                          {formatRupiah(Number(advance.amount))}
                        </td>
                        <td className="max-w-xs truncate" title={advance.reason}>
                          {advance.reason || '-'}
                        </td>
                        <td className="whitespace-nowrap">
                          {MONTH_NAMES_ID[advance.month - 1] ?? advance.month}{' '}
                          {advance.year}
                        </td>
                        <td>
                          <span className={badge.className}>{badge.label}</span>
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
    </div>
  );
}