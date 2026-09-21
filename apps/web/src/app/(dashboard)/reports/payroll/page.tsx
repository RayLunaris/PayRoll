'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { exportCsv, formatRupiah } from '@/lib/csv';
import {
  Download,
  Filter,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react';

interface Payroll {
  id: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  baseSalary: number;
  overtimePay: number;
  allowances: number;
  bpjsEmployee: number;
  taxDeduction: number;
  cashAdvance: number;
  otherDeductions: number;
  netSalary: number;
  status: 'draft' | 'processed' | 'paid' | 'cancelled';
}

interface Employee {
  id: string;
  nip: string;
  fullName: string;
  isActive: boolean;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const YEARS = [2025, 2026];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  processed: 'Diproses',
  paid: 'Dibayar',
  cancelled: 'Dibatalkan',
};

const NUM = (value: number) => Number(value || 0);

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

export default function PayrollReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [report, setReport] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: '',
  });

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/reports');
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const [payRes, empRes] = await Promise.all([
          api.get<{ data: Payroll[] }>(
            `/payrolls?month=${filters.month}&year=${filters.year}`,
          ),
          api.get<{ data: Employee[] }>('/employees?page=1&limit=100'),
        ]);
        setReport(payRes.data.data || []);
        setEmployees(empRes.data.data || []);
      } catch (error) {
        console.error('Failed to fetch payroll report:', error);
        setError('Gagal memuat data laporan payroll. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router, filters.month, filters.year]);

  const rows = report
    .filter((row) => !filters.status || row.status === filters.status)
    .map((row, index) => {
      const employee = employees.find((e) => e.id === row.employeeId);
      return {
        key: `${row.id}-${index}`,
        nip: employee?.nip || '-',
        fullName: employee?.fullName || 'Tidak ditemukan',
        baseSalary: NUM(row.baseSalary),
        overtimePay: NUM(row.overtimePay),
        totalDeductions:
          NUM(row.bpjsEmployee) +
          NUM(row.taxDeduction) +
          NUM(row.cashAdvance) +
          NUM(row.otherDeductions),
        netSalary: NUM(row.netSalary),
        status: row.status,
      };
    });

  const summary = {
    totalPayroll: rows.reduce((sum, row) => sum + row.netSalary, 0),
    totalDeductions: rows.reduce((sum, row) => sum + row.totalDeductions, 0),
    totalOvertime: rows.reduce((sum, row) => sum + row.overtimePay, 0),
  };

  const summaryCards = [
    {
      label: 'Total Penggajian',
      value: formatRupiah(summary.totalPayroll),
      icon: Wallet,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Total Potongan',
      value: formatRupiah(summary.totalDeductions),
      icon: TrendingDown,
      color: 'text-red-600 bg-red-50',
    },
    {
      label: 'Total Lembur',
      value: formatRupiah(summary.totalOvertime),
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50',
    },
  ];

  const handleExport = () => {
    exportCsv(
      `laporan-payroll-${filters.year}-${filters.month}.csv`,
      ['NIP', 'Nama', 'Gaji Pokok', 'Lembur', 'Potongan', 'Total Diterima', 'Status'],
      rows.map((row) => [
        row.nip,
        row.fullName,
        row.baseSalary,
        row.overtimePay,
        row.totalDeductions,
        row.netSalary,
        STATUS_LABEL[row.status] || row.status,
      ]),
    );
  };

  const statusBadge = (status: string) => {
    if (status === 'paid') {
      return <span className="badge badge-success">Dibayar</span>;
    }
    if (status === 'processed') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          Diproses
        </span>
      );
    }
    if (status === 'cancelled') {
      return <span className="badge badge-danger">Dibatalkan</span>;
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
        Draft
      </span>
    );
  };

  return (
    <div>
      <Breadcrumb />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Penggajian</h1>
          <p className="text-gray-500 mt-1">Rekap gaji dan potongan per periode</p>
        </div>
        <button type="button" onClick={handleExport} className="btn btn-success">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        {summaryCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className={`inline-flex p-3 rounded-lg mb-3 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filter</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="month" className="label">
              Bulan
            </label>
            <select
              id="month"
              value={filters.month}
              onChange={(e) =>
                setFilters({ ...filters, month: Number(e.target.value) })
              }
              className="input"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="year" className="label">
              Tahun
            </label>
            <select
              id="year"
              value={filters.year}
              onChange={(e) =>
                setFilters({ ...filters, year: Number(e.target.value) })
              }
              className="input"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status" className="label">
              Status Payroll
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="input"
            >
              <option value="">Semua</option>
              <option value="draft">Draft</option>
              <option value="processed">Diproses</option>
              <option value="paid">Dibayar</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Gaji Pokok</th>
                  <th>Lembur</th>
                  <th>Potongan</th>
                  <th>Total Diterima</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      Belum ada payroll untuk periode ini
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.key}>
                      <td className="font-mono text-xs">{row.nip}</td>
                      <td className="font-medium">{row.fullName}</td>
                      <td>{formatRupiah(row.baseSalary)}</td>
                      <td className="text-emerald-600">
                        {formatRupiah(row.overtimePay)}
                      </td>
                      <td className="text-red-600">
                        {formatRupiah(row.totalDeductions)}
                      </td>
                      <td className="font-semibold">
                        {formatRupiah(row.netSalary)}
                      </td>
                      <td>{statusBadge(row.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}