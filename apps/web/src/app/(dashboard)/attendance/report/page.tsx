'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { FileText, Download, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface ReportRow {
  employeeId: string;
  employeeName?: string;
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  totalOvertime: number;
}

interface EmployeeItem {
  id: string;
  nip?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  employeeNumber?: string;
}

const ALLOWED_ROLES = ['hr_admin', 'manager', 'super_admin'] as const;

export default function AttendanceReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<ReportRow[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const totalPages = Math.max(1, Math.ceil(report.length / pageSize));
  const paginatedReport = useMemo(() => {
    const start = (page - 1) * pageSize;
    return report.slice(start, start + pageSize);
  }, [report, page, pageSize]);

  // Guard: redirect non-authorised users
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // Fetch employee directory for mapping employeeId to full name
  useEffect(() => {
    if (!user || !ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
      return;
    }
    api
      .get<{ data: EmployeeItem[] }>('/employees?page=1&limit=200')
      .then((res) => {
        const map: Record<string, string> = {};
        res.data.data.forEach((emp) => {
          const name = emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Karyawan';
          const code = emp.nip || emp.employeeNumber;
          map[emp.id] = code ? `${name} (${code})` : name;
        });
        setEmployeeMap(map);
      })
      .catch((err) => {
        console.error('Failed to fetch employees list for mapping:', err);
      });
  }, [user]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    setPage(1);
    try {
      const res = await api.get<{ data: ReportRow[] }>(
        `/attendance/report?month=${month}&year=${year}`,
      );
      setReport(res.data.data);
    } catch (err) {
      console.error('Failed to fetch attendance report:', err);
      setFetchError('Gagal memuat laporan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  // Load initial report on page mount asynchronously
  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchReport();
    });
  }, [fetchReport]);

  const handleExport = () => {
    if (report.length === 0) {
      alert('Tidak ada data untuk diekspor. Silakan tampilkan laporan terlebih dahulu.');
      return;
    }

    const headers = [
      'Karyawan',
      'ID Karyawan',
      'Total Hari',
      'Hadir',
      'Terlambat',
      'Absen',
      'Total Lembur (Jam)',
    ];
    const rows = report.map((r) => [
      `"${(employeeMap[r.employeeId] || r.employeeName || r.employeeId).replace(/"/g, '""')}"`,
      `"${r.employeeId}"`,
      r.totalDays,
      r.presentDays,
      r.lateDays,
      r.absentDays,
      r.totalOvertime ?? 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `laporan-kehadiran-${year}-${String(month).padStart(2, '0')}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentYear = now.getFullYear();

  return (
    <div>
      <Breadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Kehadiran</h1>
          <p className="text-gray-500 mt-1">Rekapitulasi kehadiran karyawan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn btn-secondary">
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="label">Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="input"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(currentYear, m - 1).toLocaleDateString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="input"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button onClick={fetchReport} disabled={loading} className="btn btn-primary">
            <FileText className="h-4 w-4 mr-1" />
            Tampilkan
          </button>
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="mb-4 p-4 bg-red-50 rounded-lg text-sm text-red-700">{fetchError}</div>
      )}

      {/* Report table */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Total Hari</th>
                  <th>Hadir</th>
                  <th>Terlambat</th>
                  <th>Absen</th>
                  <th>Total Lembur</th>
                </tr>
              </thead>
              <tbody>
                {report.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      Belum ada data untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  paginatedReport.map((row, index) => (
                    <tr key={`${row.employeeId}-${index}`}>
                      <td>
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4 text-gray-400 shrink-0" />
                          <span>{employeeMap[row.employeeId] || row.employeeName || row.employeeId}</span>
                        </div>
                      </td>
                      <td>{row.totalDays}</td>
                      <td className="text-emerald-600 font-medium">{row.presentDays}</td>
                      <td className="text-yellow-600 font-medium">{row.lateDays}</td>
                      <td className="text-red-600 font-medium">{row.absentDays}</td>
                      <td>{row.totalOvertime ?? 0} jam</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {!loading && report.length > pageSize && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <span>
              Menampilkan {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, report.length)} dari {report.length} karyawan
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="btn btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                Sebelumnya
              </button>
              <span className="px-2 font-medium text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary py-1 px-2.5 text-xs disabled:opacity-40"
                aria-label="Halaman berikutnya"
              >
                Berikutnya
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
