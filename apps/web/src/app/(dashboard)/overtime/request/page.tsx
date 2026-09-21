'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  CalendarPlus,
} from 'lucide-react';

const overtimeSchema = z.object({
  date: z.string().min(1, 'Tanggal wajib diisi'),
  hours: z
    .number({ invalid_type_error: 'Jam harus berupa angka' })
    .min(0.5, 'Minimal 0.5 jam')
    .max(8, 'Maksimal 8 jam'),
  reason: z.string().min(10, 'Alasan minimal 10 karakter'),
});

type OvertimeFormData = z.infer<typeof overtimeSchema>;

const HOUR_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function OvertimeRequestPage() {
  const user = useAuthStore((state) => state.user);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoHours, setAutoHours] = useState<number | null>(null);
  const [checkingAuto, setCheckingAuto] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OvertimeFormData>({
    resolver: zodResolver(overtimeSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      hours: 1,
    },
  });

  const selectedDate = watch('date');

  // Fetch auto-overtime for the selected date (informational)
  useEffect(() => {
    if (!selectedDate) return;
    setCheckingAuto(true);
    api
      .get<{ data: { overtimeHours: string }[] }>('/attendance', {
        params: { date: selectedDate },
      })
      .then((res) => {
        const records = res.data?.data || [];
        if (records.length > 0) {
          const autoH = parseFloat(records[0].overtimeHours || '0');
          setAutoHours(autoH > 0 ? autoH : null);
        } else {
          setAutoHours(null);
        }
      })
      .catch(() => setAutoHours(null))
      .finally(() => setCheckingAuto(false));
  }, [selectedDate]);

  const onSubmit = async (data: OvertimeFormData) => {
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      await api.post('/attendance/overtime-requests', {
        date: data.date,
        hours: data.hours,
        reason: data.reason,
      });
      setSuccess(`Pengajuan lembur ${data.hours} jam untuk ${formatDate(data.date)} berhasil dikirim dan menunggu persetujuan.`);
      reset({
        date: new Date().toISOString().slice(0, 10),
        hours: 1,
        reason: '',
      });
      setAutoHours(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Gagal mengirim pengajuan lembur. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pengajuan Lembur</h1>
        <p className="text-gray-500 mt-1">
          Ajukan lembur untuk mendapatkan persetujuan dari manager atau HR
        </p>
      </div>

      <div className="max-w-lg">
        {success && (
          <div className="mb-5 flex items-start gap-3 p-4 rounded-lg bg-emerald-50 text-emerald-800">
            <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-3 p-4 rounded-lg bg-red-50 text-red-800">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <CalendarPlus className="h-5 w-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">Form Pengajuan</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Tanggal */}
            <div>
              <label htmlFor="ot-date" className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Lembur <span className="text-red-500">*</span>
              </label>
              <input
                id="ot-date"
                type="date"
                {...register('date')}
                className="input"
                max={new Date().toISOString().slice(0, 10)}
              />
              {errors.date && (
                <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>
              )}

              {/* Info: auto-overtime */}
              {!checkingAuto && autoHours !== null && (
                <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Sistem mendeteksi {autoHours} jam lembur otomatis dari checkout hari ini.
                    Jika Anda mengajukan request dan disetujui, nilai request ini yang akan digunakan.
                  </span>
                </div>
              )}
            </div>

            {/* Jam Lembur */}
            <div>
              <label htmlFor="ot-hours" className="block text-sm font-medium text-gray-700 mb-1">
                Jumlah Jam <span className="text-red-500">*</span>
              </label>
              <select
                id="ot-hours"
                {...register('hours', { valueAsNumber: true })}
                className="input"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h} jam
                  </option>
                ))}
              </select>
              {errors.hours && (
                <p className="mt-1 text-xs text-red-600">{errors.hours.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Dihitung berdasarkan regulasi Indonesia: jam ke-1 × 1,5; jam berikutnya × 2,0
              </p>
            </div>

            {/* Alasan */}
            <div>
              <label htmlFor="ot-reason" className="block text-sm font-medium text-gray-700 mb-1">
                Alasan / Deskripsi Pekerjaan <span className="text-red-500">*</span>
              </label>
              <textarea
                id="ot-reason"
                {...register('reason')}
                rows={4}
                className="input resize-none"
                placeholder="Contoh: Menyelesaikan deployment sistem sebelum deadline besok pagi..."
              />
              {errors.reason && (
                <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
              )}
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Pengajuan akan masuk ke antrean persetujuan manager / HR. Anda bisa memantau
                statusnya di <strong>Riwayat Lembur</strong>.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              <Clock className="h-4 w-4" />
              {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
