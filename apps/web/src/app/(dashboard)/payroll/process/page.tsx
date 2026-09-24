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

interface BudgetCheckData {
  budgetYear: number;
  allocatedAmount: number;
  spentAmount: number;
  remainingBudget: number;
  estimatedPayroll: number;
  isOverbudget: boolean;
  overbudgetAmount: number;
}

export default function PayrollProcessPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const [budgetCheck, setBudgetCheck] = useState<BudgetCheckData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [confirmOverbudget, setConfirmOverbudget] = useState(false);

  // Role guard
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role as UserRole)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // Check budget on month/year change
  useEffect(() => {
    const fetchBudgetCheck = async () => {
      setBudgetLoading(true);
      setConfirmOverbudget(false);
      try {
        const res = await api.get<{ success: boolean; data: BudgetCheckData }>(
          `/budgets/check-payroll?month=${month}&year=${year}`
        );
        if (res.data?.success) {
          setBudgetCheck(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch budget check:', err);
      } finally {
        setBudgetLoading(false);
      }
    };

    fetchBudgetCheck();
  }, [month, year]);

  const formatCurrency = (val: number) =>
    'Rp ' + Number(val || 0).toLocaleString('id-ID');

  const handleProcess = async () => {
    if (budgetCheck?.isOverbudget && !confirmOverbudget) {
      alert('Harap centang konfirmasi overbudget sebelum memproses payroll.');
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const response = await api.post<ProcessResult>('/payrolls/process', {
        month,
        year,
      });
      setResult(response.data);
      // Re-fetch budget check after processing to reflect new spent amount
      const res = await api.get<{ success: boolean; data: BudgetCheckData }>(
        `/budgets/check-payroll?month=${month}&year=${year}`
      );
      if (res.data?.success) {
        setBudgetCheck(res.data.data);
      }
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
          Proses perhitungan gaji otomatis termasuk tunjangan jabatan, lembur, BPJS, PPh 21, dan
          sinkronisasi anggaran perusahaan
        </p>
      </div>

      {/* Budget Guardrail Banner */}
      {budgetCheck && budgetCheck.isOverbudget && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-bold text-base text-red-900">
                Peringatan: Estimasi Payroll Melebihi Sisa Anggaran Perusahaan!
              </h4>
              <p className="text-sm text-red-700 mt-1">
                Estimasi kebutuhan payroll periode ini adalah{' '}
                <span className="font-semibold">{formatCurrency(budgetCheck.estimatedPayroll)}</span>, sedangkan sisa pagu anggaran tahun {budgetCheck.budgetYear} hanya{' '}
                <span className="font-semibold">{formatCurrency(budgetCheck.remainingBudget)}</span>. Terjadi potensi defisit sebesar{' '}
                <span className="font-bold underline">{formatCurrency(budgetCheck.overbudgetAmount)}</span>.
              </p>

              <div className="mt-4 pt-3 border-t border-red-200 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="confirmOverbudget"
                  checked={confirmOverbudget}
                  onChange={(e) => setConfirmOverbudget(e.target.checked)}
                  className="rounded border-red-400 text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <label htmlFor="confirmOverbudget" className="text-xs sm:text-sm font-medium text-red-950 cursor-pointer">
                  Saya memahami risiko defisit anggaran dan telah mengantongi persetujuan Finance/Direksi untuk memproses periode ini.
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

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

            {/* Budget status preview */}
            {budgetCheck && (
              <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1.5 border border-gray-100">
                <div className="flex justify-between text-gray-600">
                  <span>Estimasi Beban Payroll:</span>
                  <span className="font-semibold text-gray-900">
                    {budgetLoading ? 'Menghitung...' : formatCurrency(budgetCheck.estimatedPayroll)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Sisa Pagu Anggaran ({budgetCheck.budgetYear}):</span>
                  <span className={`font-semibold ${budgetCheck.isOverbudget ? 'text-red-600' : 'text-emerald-600'}`}>
                    {budgetLoading ? 'Memeriksa...' : formatCurrency(budgetCheck.remainingBudget)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={processing || (budgetCheck?.isOverbudget && !confirmOverbudget)}
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <span className="text-gray-600">Gaji pokok & Tunjangan jabatan</span>
              <span className="font-medium text-emerald-600">Standar Berjenjang</span>
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
              <span className="text-gray-600">PPh 21 progresif (TER & Pasal 17)</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Kasbon (maks 25% gaji)</span>
              <span className="font-medium">Otomatis</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Alokasi Beban Proyek (FTE %)</span>
              <span className="font-medium text-blue-600">Project Costing</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Sinkronisasi Realisasi Anggaran</span>
              <span className="font-medium text-purple-600">Budget Burn Auto</span>
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