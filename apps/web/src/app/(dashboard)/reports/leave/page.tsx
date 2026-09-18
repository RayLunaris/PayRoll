'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { exportCsv } from '@/lib/csv';
import {
  CalendarDays,
  Download,
  Filter,
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface LeaveRecord {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
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

const ALLOWED_ROLES = ['hr_admin', 'super_admin', 'manager'];

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const YEARS = [2024, 2025, 2026, 2027];

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Cuti Sakit',
  maternity: 'Cuti Melahirkan',
  paternity: 'Cuti Ayah',
  special: 'Cuti Khusus',
  unpaid: 'Cuti Tanpa Gaji',
};

function calculateDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 1;
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function LeaveReportPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [deptFilter, setDeptFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/reports');
    }
  }, [user, router]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [leavesRes, empRes, deptRes] = await Promise.all([
          api.get<{ data: LeaveRecord[] }>(`/leaves?page=1&limit=500`).catch(() => ({ data: { data: [] } })),
          api.get<{ data: Employee[] }>('/employees?page=1&limit=200').catch(() => ({ data: { data: [] } })),
          api.get<{ data: Department[] }>('/departments').catch(() => ({ data: { data: [] } })),
        ]);

        setLeaves(leavesRes.data.data || []);
        setEmployees(empRes.data.data || []);
        setDepartments(deptRes.data.data || []);
      } catch (err) {
        console.error('Failed to load leave report:', err);
        setError('Gagal memuat data laporan cuti.');
      } finally {
        setLoading(false);
      }
    })();
  }, [month, year]);

  // Enrich and filter by period
  const enrichedRows = useMemo(() => {
    const monthStr = String(month).padStart(2, '0');
    const periodPrefix = `${year}-${monthStr}`;

    return leaves
      .filter((l) => l.startDate.startsWith(periodPrefix) || l.endDate.startsWith(periodPrefix))
      .map((l) => {
        const emp = employees.find((e) => e.id === l.employeeId);
        const dept = emp ? departments.find((d) => d.id === emp.departmentId) : null;
        const days = calculateDays(l.startDate, l.endDate);

        return {
          ...l,
          employeeName: emp?.fullName || 'Karyawan',
          employeeNip: emp?.nip || '-',
          departmentId: emp?.departmentId || null,
          departmentName: dept?.name || '-',
          durationDays: days,
        };
      });
  }, [leaves, employees, departments, month, year]);

  const filteredRows = useMemo(() => {
    return enrichedRows.filter((r) => {
      if (deptFilter !== 'all' && r.departmentId !== deptFilter) return false;
      if (typeFilter !== 'all' && r.leaveType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.employeeName.toLowerCase().includes(q) ||
          r.employeeNip.toLowerCase().includes(q) ||
          r.departmentName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [enrichedRows, deptFilter, typeFilter, search]);

  const stats = useMemo(() => {
    const total = enrichedRows.length;
    const approved = enrichedRows.filter((r) => r.status === 'approved').length;
    const sick = enrichedRows.filter((r) => r.leaveType === 'sick').length;
    const annual = enrichedRows.filter((r) => r.leaveType === 'annual').length;
    const totalDays = enrichedRows
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + r.durationDays, 0);

    return { total, approved, sick, annual, totalDays };
  }, [enrichedRows]);

  const handleExport = () => {
    exportCsv(
      `laporan-cuti-${year}-${month}.csv`,
      ['NIP', 'Nama Karyawan', 'Departemen', 'Jenis Cuti', 'Mulai', 'Selesai', 'Durasi (Hari)', 'Alasan', 'Status'],
      filteredRows.map((r) => [
        r.employeeNip,
        r.employeeName,
        r.departmentName,
        LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType,
        r.startDate,
        r.endDate,
        r.durationDays,
        r.reason || '-',
        r.status,
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-600" />
            Laporan Cuti Karyawan
          </h1>
          <p className="text-gray-500 mt-1">
            Rekapitulasi pengajuan dan pemakaian cuti karyawan per periode.
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={filteredRows.length === 0}
          className="btn btn-outline flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 bg-gradient-to-br from-blue-50 to-white border border-blue-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Total Pengajuan
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.total}</p>
          <p className="mt-3 text-xs text-gray-500">Periode {MONTHS[month - 1]} {year}</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Cuti Disetujui
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.approved}</p>
          <p className="mt-3 text-xs text-emerald-700 font-medium">Total {stats.totalDays} hari kerja</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Cuti Tahunan
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.annual}</p>
          <p className="mt-3 text-xs text-gray-500">Pengurangan kuota tahunan</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-rose-50 to-white border border-rose-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
            Cuti Sakit
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.sick}</p>
          <p className="mt-3 text-xs text-gray-500">Dengan surat keterangan dokter</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Filter className="h-4 w-4" />
              <span>Filter:</span>
            </div>

            <select
              aria-label="Pilih Bulan"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>

            <select
              aria-label="Pilih Tahun"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              aria-label="Pilih Departemen"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Semua Departemen</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Pilih Jenis Cuti"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Semua Jenis Cuti</option>
              {Object.entries(LEAVE_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama, NIP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            Daftar Pemakaian Cuti
          </h2>
          <span className="text-xs text-gray-500">
            Ditemukan {filteredRows.length} data cuti
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Memuat laporan cuti...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <CalendarDays className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-700">Tidak ada data cuti</p>
            <p className="text-xs text-gray-400 mt-1">
              Tidak ada catatan cuti pada periode yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-700">
                <tr>
                  <th className="px-6 py-3">Karyawan</th>
                  <th className="px-6 py-3">Departemen</th>
                  <th className="px-6 py-3">Jenis Cuti</th>
                  <th className="px-6 py-3">Periode Cuti</th>
                  <th className="px-6 py-3">Durasi</th>
                  <th className="px-6 py-3">Alasan</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{r.employeeName}</div>
                      <div className="text-xs text-gray-400">NIP: {r.employeeNip}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{r.departmentName}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                      {r.startDate} s/d {r.endDate}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {r.durationDays} hari
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">
                      {r.reason || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {r.status === 'approved' && (
                        <span className="badge badge-success">Disetujui</span>
                      )}
                      {r.status === 'pending' && (
                        <span className="badge badge-warning">Menunggu</span>
                      )}
                      {r.status === 'rejected' && (
                        <span className="badge badge-danger">Ditolak</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
