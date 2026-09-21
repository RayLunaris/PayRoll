'use client';

import { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import type { Payroll } from '@/types';
import { Download, FileText, Wallet, AlertCircle } from 'lucide-react';

type PayrollStatus = Payroll['status'];

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
  PayrollStatus,
  { label: string; className: string }
> = {
  draft: { label: 'Draft', className: 'badge badge-gray' },
  processed: { label: 'Diproses', className: 'badge badge-info' },
  paid: { label: 'Dibayar', className: 'badge badge-success' },
  cancelled: { label: 'Dibatalkan', className: 'badge badge-gray' },
};

function formatRupiah(value: number | string): string {
  const amount = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(amount)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function PayslipsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [slips, setSlips] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchSlips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ data: Payroll[] }>(
        `/payrolls/my?month=${month}&year=${year}`,
      );
      setSlips(response.data.data || []);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr.response?.data?.error ||
          'Gagal memuat slip gaji. Silakan coba lagi.',
      );
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void (async () => {
      await fetchSlips();
    })();
  }, [fetchSlips]);

  const downloadSlip = async (id: string) => {
    setDownloadingId(id);
    try {
      const response = await api.get(`/payrolls/${id}/slip`, {
        responseType: 'blob',
      });

      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `slip-gaji-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error('Failed to download payslip:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Slip Gaji</h1>
          <p className="text-gray-500 mt-1">
            Slip gaji paperless dapat diunduh dalam format PDF
          </p>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="slipMonth"
            className="text-sm font-medium text-gray-700 whitespace-nowrap"
          >
            Periode:
          </label>
          <select
            id="slipMonth"
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
            id="slipYear"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="input w-28"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
              (y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ),
            )}
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
        ) : slips.length === 0 ? (
          <div className="text-center py-12 text-gray-500 space-y-2">
            <Wallet className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="font-medium text-gray-700">Belum Ada Slip Gaji</p>
            <p className="text-sm">
              Belum ada slip gaji untuk periode{' '}
              {MONTH_NAMES_ID[month - 1]} {year}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Gaji Pokok</th>
                  <th>Lembur</th>
                  <th>Tunjangan</th>
                  <th>Potongan</th>
                  <th>Gaji Bersih</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((slip) => {
                  const deductions =
                    Number(slip.bpjsEmployee || 0) +
                    Number(slip.taxDeduction || 0) +
                    Number(slip.cashAdvance || 0) +
                    Number(slip.otherDeductions || 0);
                  const badge = STATUS_BADGES[slip.status] || {
                    label: slip.status,
                    className: 'badge badge-gray',
                  };

                  return (
                    <tr key={slip.id}>
                      <td className="font-medium text-gray-900 whitespace-nowrap">
                        {MONTH_NAMES_ID[slip.periodMonth - 1] ?? slip.periodMonth}{' '}
                        {slip.periodYear}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatRupiah(slip.baseSalary)}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatRupiah(slip.overtimePay)}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatRupiah(slip.allowances)}
                      </td>
                      <td className="text-red-600 whitespace-nowrap">
                        -{formatRupiah(deductions)}
                      </td>
                      <td className="font-semibold text-emerald-600 whitespace-nowrap">
                        {formatRupiah(slip.netSalary)}
                      </td>
                      <td>
                        <span className={badge.className}>{badge.label}</span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => downloadSlip(slip.id)}
                          disabled={downloadingId === slip.id}
                          className="btn btn-secondary btn-sm text-xs inline-flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadingId === slip.id ? 'Mengunduh...' : 'PDF'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {slips.length > 0 && (
        <p className="mt-4 text-xs text-gray-400 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Unduh slip PDF dengan menekan tombol PDF pada baris periode yang
          diinginkan.
        </p>
      )}
    </div>
  );
}