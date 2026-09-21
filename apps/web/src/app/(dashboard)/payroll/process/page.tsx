'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { Payroll, UserRole } from '@/types';
import {
  FileText,
  Settings2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const ALLOWED_ROLES: UserRole[] = ['hr_admin', 'super_admin'];

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

interface ProcessResult {
  success: boolean;
  data?: Payroll[];
  message?: string;
  error?: string;
}

export default function PayrollProcessPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);

  // Role guard
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role as UserRole)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const handleProcess = async () => {
    setProcessing(true);
    setResult(null);

    try {
      const response = await api.post<ProcessResult>('/payrolls/process', {
        month,
        year,
      });
      setResult(response.data);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string } };
      };
      setResult({
        success: false,
        error:
          axiosErr.response?.data?.error ||
          'Terjadi kesalahan saat proses payroll. Silakan coba lagi.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const processedCount = result?.data?.length ?? 0;

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proses Payroll</h1>
        <p className="text-gray-500 mt-1">
          Proses perhitungan gaji otomatis termasuk lembur, BPJS, PPh 21, dan
          kasbon
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processing form */}
        <div className="card h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-blue-600" />
            Konfigurasi Payroll
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="processMonth" className="label">
                  Bulan
                </label>
                <select
                  id="processMonth"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                  className="input"
                >
                  {MONTH_NAMES_ID.map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="processYear" className="label">
                  Tahun
                </label>
                <select
                  id="processYear"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10))}
                  className="input"
                >
                  {[year - 1, year, year + 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleProcess}
              disabled={processing}
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Proses Payroll
                </>
              )}
            </button>

            {!processing && result && result.success && (
              <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">
                    {result.message}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {processedCount > 0
                      ? `Berhasil memproses ${processedCount} payroll.`
                      : 'Tidak ada payroll baru yang diproses untuk periode ini.'}
                  </p>
                </div>
              </div>
            )}

            {!processing && result && !result.success && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{result.error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="card h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Yang Dihitung Otomatis
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Gaji pokok per jabatan</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Lembur (custom rates)</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">
                BPJS Ketenagakerjaan & Kesehatan
              </span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">PPh 21 progresif</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Kasbon (maks 25% gaji)</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Slip gaji PDF</span>
              <span className="font-medium text-emerald-600">Siap download</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}