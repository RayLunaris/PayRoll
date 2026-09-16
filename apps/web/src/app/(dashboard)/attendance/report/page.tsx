'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { FileText, Download, UserCircle } from 'lucide-react';

interface ReportRow {
  employeeId: string;
  employeeName?: string;
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  totalOvertime: number;
}

const ALLOWED_ROLES = ['hr_admin', 'manager', 'super_admin'] as const;

export default function AttendanceReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Guard: redirect non-authorised users
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const fetchReport = async () => {
    setLoading(true);
    setFetchError('');
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
  };

  const handleExport = () => {
    // TODO: implement CSV/Excel export
    alert('Fitur export akan segera tersedia.');
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
            Export
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
                      Belum ada data untuk periode ini. Klik &ldquo;Tampilkan&rdquo; untuk memuat laporan.
                    </td>
                  </tr>
                ) : (
                  report.map((row, index) => (
                    <tr key={`${row.employeeId}-${index}`}>
                      <td>
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4 text-gray-400 shrink-0" />
                          <span>{row.employeeName ?? row.employeeId}</span>
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
      </div>
    </div>
  );
}
