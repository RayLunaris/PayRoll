'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { exportCsv, formatRupiah } from '@/lib/csv';
import { Download, Loader2 } from 'lucide-react';

interface AttendanceSummary {
  employeeId: string;
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  totalOvertime: number;
}

interface Employee {
  id: string;
  nip: string;
  fullName: string;
  departmentId: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Payroll {
  employeeId: string;
  overtimePay: number;
  status: 'draft' | 'processed' | 'paid' | 'cancelled';
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const YEARS = [2025, 2026];

const NUM = (value: number) => Number(value || 0);

const ALLOWED_ROLES = ['hr_admin', 'super_admin', 'manager'];

export default function OvertimeReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [report, setReport] = useState<AttendanceSummary[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/reports');
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const [attRes, payRes, empRes, deptRes] = await Promise.all([
          api.get<{ data: AttendanceSummary[] }>(
            `/attendance/report?month=${filters.month}&year=${filters.year}`,
          ),
          api.get<{ data: Payroll[] }>(
            `/payrolls?month=${filters.month}&year=${filters.year}`,
          ),
          api.get<{ data: Employee[] }>('/employees?page=1&limit=100'),
          api.get<{ data: Department[] }>('/departments'),
        ]);
        setReport(attRes.data.data || []);
        setPayrolls(payRes.data.data || []);
        setEmployees(empRes.data.data || []);
        setDepartments(deptRes.data.data || []);
      } catch (error) {
        console.error('Failed to fetch overtime report:', error);
        setError('Gagal memuat data laporan lembur. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router, filters.month, filters.year]);

  const rows = report
    .map((row) => {
      const employee = employees.find((e) => e.id === row.employeeId);
      const payroll = payrolls.find((p) => p.employeeId === row.employeeId);
      return {
        id: row.employeeId,
        nip: employee?.nip || '-',
        fullName: employee?.fullName || 'Tidak ditemukan',
        department: employee
          ? departments.find((d) => d.id === employee.departmentId)?.name ||
            '-'
          : '-',
        totalHours: NUM(row.totalOvertime),
        overtimePay: payroll ? NUM(payroll.overtimePay) : null,
      };
    })
    .filter((row) => row.totalHours > 0 || row.overtimePay !== null);

  const handleExport = () => {
    exportCsv(
      `laporan-lembur-${filters.year}-${filters.month}.csv`,
      ['NIP', 'Nama', 'Departemen', 'Total Jam Lembur', 'Biaya Lembur'],
      rows.map((row) => [
        row.nip,
        row.fullName,
        row.department,
        row.totalHours,
        row.overtimePay !== null ? row.overtimePay : 'Belum diproses',
      ]),
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
          <h1 className="text-2xl font-bold text-gray-900">Laporan Lembur</h1>
          <p className="text-gray-500 mt-1">Rekap jam dan biaya lembur karyawan</p>
        </div>
        <button type="button" onClick={handleExport} className="btn btn-success">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-2 gap-4 max-w-md">
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
        </div>
      </div>

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
                  <th>Departemen</th>
                  <th>Total Jam Lembur</th>
                  <th>Biaya Lembur</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      Tidak ada data lembur untuk periode ini
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.nip}</td>
                      <td className="font-medium">{row.fullName}</td>
                      <td>{row.department}</td>
                      <td className="text-center">{row.totalHours} jam</td>
                      <td>
                        {row.overtimePay !== null
                          ? formatRupiah(row.overtimePay)
                          : 'Belum diproses'}
                      </td>
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