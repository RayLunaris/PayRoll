'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { exportCsv } from '@/lib/csv';
import { Download, Filter, Loader2 } from 'lucide-react';

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
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const YEARS = [2025, 2026];

const ALLOWED_ROLES = ['hr_admin', 'super_admin', 'manager'];

export default function AttendanceReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [report, setReport] = useState<AttendanceSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    department: '',
  });

  const employeeById = (id: string) => employees.find((e) => e.id === id);
  const departmentName = (id: string | null) =>
    departments.find((d) => d.id === id)?.name || '-';

  const rows = report
    .map((row) => {
      const employee = employeeById(row.employeeId);
      return {
        id: row.employeeId,
        nip: employee?.nip || '-',
        fullName: employee?.fullName || 'Tidak ditemukan',
        department: employee ? departmentName(employee.departmentId) : '-',
        totalPresent: row.presentDays,
        totalLate: row.lateDays,
        totalAbsent: row.absentDays,
        totalOvertime: row.totalOvertime,
        attendanceRate:
          row.totalDays > 0
            ? Math.round((row.presentDays / row.totalDays) * 100)
            : 0,
        raw: row,
      };
    })
    .filter(
      (row) => !filters.department || row.department === filters.department,
    );

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/reports');
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const [attRes, empRes, deptRes] = await Promise.all([
          api.get<{ data: AttendanceSummary[] }>(
            `/attendance/report?month=${filters.month}&year=${filters.year}`,
          ),
          api.get<{ data: Employee[] }>('/employees?page=1&limit=100'),
          api.get<{ data: Department[] }>('/departments'),
        ]);
        setReport(attRes.data.data || []);
        setEmployees(empRes.data.data || []);
        setDepartments(deptRes.data.data || []);
      } catch (error) {
        console.error('Failed to fetch attendance report:', error);
        setError('Gagal memuat data laporan kehadiran. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router, filters.month, filters.year]);

  const handleExport = () => {
    exportCsv(
      `laporan-kehadiran-${filters.year}-${filters.month}.csv`,
      ['NIP', 'Nama', 'Departemen', 'Hadir', 'Telat', 'Alpha', 'Lembur (jam)', '% Kehadiran'],
      rows.map((row) => [
        row.nip,
        row.fullName,
        row.department,
        row.totalPresent,
        row.totalLate,
        row.totalAbsent,
        row.totalOvertime,
        `${row.attendanceRate}%`,
      ]),
    );
  };

  const departmentOptions = departments.map((d) => d.name);

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
          <h1 className="text-2xl font-bold text-gray-900">
            Laporan Kehadiran
          </h1>
          <p className="text-gray-500 mt-1">
            Rekap kehadiran dan keterlambatan karyawan
          </p>
        </div>
        <button type="button" onClick={handleExport} className="btn btn-success">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
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
            <label htmlFor="department" className="label">
              Departemen
            </label>
            <select
              id="department"
              value={filters.department}
              onChange={(e) =>
                setFilters({ ...filters, department: e.target.value })
              }
              className="input"
            >
              <option value="">Semua</option>
              {departmentOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
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
                  <th>Departemen</th>
                  <th>Hadir</th>
                  <th>Telat</th>
                  <th>Alpha</th>
                  <th>Lembur (jam)</th>
                  <th>% Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      Tidak ada data untuk periode ini
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.nip}</td>
                      <td className="font-medium">{row.fullName}</td>
                      <td>{row.department}</td>
                      <td className="text-center">{row.totalPresent}</td>
                      <td className="text-center text-red-600">
                        {row.totalLate}
                      </td>
                      <td className="text-center">{row.totalAbsent}</td>
                      <td className="text-center">{row.totalOvertime}</td>
                      <td>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.attendanceRate >= 80
                                  ? 'bg-emerald-500'
                                  : row.attendanceRate >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${row.attendanceRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">
                            {row.attendanceRate}%
                          </span>
                        </div>
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