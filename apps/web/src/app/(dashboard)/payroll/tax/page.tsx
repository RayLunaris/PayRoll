'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { Payroll, UserRole } from '@/types';
import { Receipt, AlertCircle } from 'lucide-react';

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

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

export default function TaxReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const currentYear = new Date().getFullYear();

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Role guard
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role as UserRole)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ data: Payroll[] }>(
        `/payrolls?month=${month}&year=${year}`,
      );
      setPayrolls(response.data.data || []);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error ||
          'Gagal memuat laporan pajak. Silakan coba lagi.',
      );
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void (async () => {
      await fetchReport();
    })();
  }, [fetchReport]);

  const totalTax = payrolls.reduce(
    (sum, p) => sum + Number(p.taxDeduction || 0),
    0,
  );
  const totalGross = payrolls.reduce(
    (sum, p) =>
      sum +
      Number(p.baseSalary || 0) +
      Number(p.overtimePay || 0) +
      Number(p.allowances || 0),
    0,
  );

  return (
    <div>
      <Breadcrumb />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-blue-600" />
            Laporan Pajak PPh 21
          </h1>
          <p className="text-gray-500 mt-1">
            Rekapitulasi pajak penghasilan karyawan (progresif)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="taxMonth"
            className="text-sm font-medium text-gray-700 whitespace-nowrap"
          >
            Periode:
          </label>
          <select
            id="taxMonth"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            className="input w-36"
          >
            {MONTH_NAMES_ID.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            id="taxYear"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="input w-28"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : payrolls.length === 0 ? (
          <div className="text-center py-12 text-gray-500 space-y-2">
            <Receipt className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="font-medium text-gray-700">Tidak Ada Data Payroll</p>
            <p className="text-sm">
              Tidak ada data payroll untuk periode{' '}
              {MONTH_NAMES_ID[month - 1]} {year}. Jalankan proses payroll
              terlebih dahulu.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-b border-gray-100">
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                  Total Penghasilan Bruto
                </p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {formatRupiah(totalGross)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {payrolls.length} karyawan
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <p className="text-xs font-medium text-red-700 uppercase tracking-wide">
                  Total PPh 21
                </p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {formatRupiah(totalTax)}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Potongan pajak karyawan
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  Rata-rata per Karyawan
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatRupiah(
                    payrolls.length > 0 ? totalTax / payrolls.length : 0,
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">PPh 21 per orang</p>
              </div>
            </div>

            <div className="p-6">
              <p className="text-xs text-gray-500">
                Perhitungan PPh 21 menggunakan tarif progresif, PTKP, dan biaya
                jabatan sesuai konfigurasi pajak. Angka detail per karyawan
                tercatat pada slip gaji periode {MONTH_NAMES_ID[month - 1]}{' '}
                {year}.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}