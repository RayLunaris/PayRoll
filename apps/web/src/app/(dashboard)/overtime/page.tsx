'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import {
  Clock,
  Calendar,
  Users,
  TrendingUp,
  Settings,
  FileText,
  Loader2,
  Search,
  Filter,
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  overtimeHours: string | number;
  status: string;
  notes: string | null;
  employeeName?: string;
  employeeNip?: string;
  departmentName?: string;
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

interface OvertimeRate {
  id: string;
  name: string;
  multiplier: string | number;
  dayType: string;
  isActive: boolean;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const YEARS = [2024, 2025, 2026, 2027];

export default function OvertimePage() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rates, setRates] = useState<OvertimeRate[]>([]);

  const isManagerOrAdmin = user && ['super_admin', 'hr_admin', 'manager'].includes(user.role);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const promises: Promise<any>[] = [
          api.get<{ data: AttendanceRecord[] }>(`/attendance/history?month=${month}&year=${year}`),
          api.get<{ data: OvertimeRate[] }>('/overtime-rates').catch(() => ({ data: { data: [] } })),
        ];

        if (isManagerOrAdmin) {
          promises.push(
            api.get<{ data: Employee[] }>('/employees?page=1&limit=200').catch(() => ({ data: { data: [] } })),
            api.get<{ data: Department[] }>('/departments').catch(() => ({ data: { data: [] } })),
          );
        }

        const results = await Promise.all(promises);
        const attData = results[0]?.data?.data || [];
        const rateData = results[1]?.data?.data || [];
        const empData = results[2]?.data?.data || [];
        const deptData = results[3]?.data?.data || [];

        setRecords(attData);
        setRates(rateData);
        setEmployees(empData);
        setDepartments(deptData);
      } catch (err) {
        console.error('Failed to load overtime records:', err);
        setError('Gagal memuat data lembur. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [month, year, isManagerOrAdmin]);

  // Enrich records with employee and department info
  const enrichedRecords = useMemo(() => {
    return records
      .filter((rec) => {
        const hours = parseFloat(String(rec.overtimeHours || '0'));
        return hours > 0;
      })
      .map((rec) => {
        const emp = employees.find((e) => e.id === rec.employeeId);
        const dept = emp ? departments.find((d) => d.id === emp.departmentId) : null;
        return {
          ...rec,
          employeeName: emp?.fullName || (user?.role === 'employee' ? user.email : 'Karyawan'),
          employeeNip: emp?.nip || '-',
          departmentName: dept?.name || '-',
        };
      });
  }, [records, employees, departments, user]);

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return enrichedRecords;
    const q = search.toLowerCase();
    return enrichedRecords.filter(
      (r) =>
        r.employeeName?.toLowerCase().includes(q) ||
        r.employeeNip?.toLowerCase().includes(q) ||
        r.departmentName?.toLowerCase().includes(q) ||
        r.date.includes(q),
    );
  }, [enrichedRecords, search]);

  const totalOvertimeHours = useMemo(() => {
    return enrichedRecords.reduce((sum, r) => sum + parseFloat(String(r.overtimeHours || '0')), 0);
  }, [enrichedRecords]);

  const uniqueEmployeesCount = useMemo(() => {
    const ids = new Set(enrichedRecords.map((r) => r.employeeId));
    return ids.size;
  }, [enrichedRecords]);

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-blue-600" />
            Manajemen Lembur (Overtime)
          </h1>
          <p className="text-gray-500 mt-1">
            Pantau dan kelola jam lembur otomatis dari catatan presensi kerja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isManagerOrAdmin && (
            <>
              <Link
                href="/settings/overtime"
                className="btn btn-outline flex items-center gap-1.5 text-sm"
              >
                <Settings className="h-4 w-4" />
                Tarif Lembur
              </Link>
              <Link
                href="/reports/overtime"
                className="btn btn-primary flex items-center gap-1.5 text-sm"
              >
                <FileText className="h-4 w-4" />
                Laporan Lembur
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 bg-gradient-to-br from-blue-50 to-white border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Total Jam Lembur
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {totalOvertimeHours.toFixed(1)} <span className="text-sm font-normal text-gray-500">jam</span>
              </p>
            </div>
            <div className="rounded-xl bg-blue-600/10 p-3 text-blue-600">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">Periode {MONTHS[month - 1]} {year}</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Karyawan Lembur
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {uniqueEmployeesCount} <span className="text-sm font-normal text-gray-500">orang</span>
              </p>
            </div>
            <div className="rounded-xl bg-indigo-600/10 p-3 text-indigo-600">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">Bekerja di luar jam shift</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-amber-50 to-white border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Sesi Lembur Tercatat
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {enrichedRecords.length} <span className="text-sm font-normal text-gray-500">sesi</span>
              </p>
            </div>
            <div className="rounded-xl bg-amber-600/10 p-3 text-amber-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">Rata-rata {(totalOvertimeHours / (enrichedRecords.length || 1)).toFixed(1)} jam / sesi</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Tarif Lembur Aktif
              </p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {rates.filter((r) => r.isActive).length || 3} <span className="text-sm font-normal text-gray-500">Kategori</span>
              </p>
            </div>
            <div className="rounded-xl bg-emerald-600/10 p-3 text-emerald-600">
              <Settings className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-emerald-700 font-medium">Weekday, Weekend, Hari Libur</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Filter className="h-4 w-4" />
              <span>Filter:</span>
            </div>

            <div className="flex items-center gap-2">
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
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama, NIP, tanggal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Overtime Records Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            Daftar Catatan Lembur
          </h2>
          <span className="text-xs text-gray-500">
            Ditemukan {filteredRecords.length} catatan lembur
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Memuat catatan lembur...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Clock className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-700">Tidak ada catatan lembur</p>
            <p className="text-xs text-gray-400 mt-1">
              Tidak ada jam lembur yang tercatat pada periode {MONTHS[month - 1]} {year}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-700">
                <tr>
                  <th className="px-6 py-3">Tanggal</th>
                  {isManagerOrAdmin && <th className="px-6 py-3">Karyawan</th>}
                  {isManagerOrAdmin && <th className="px-6 py-3">Departemen</th>}
                  <th className="px-6 py-3">Jam Masuk</th>
                  <th className="px-6 py-3">Jam Pulang</th>
                  <th className="px-6 py-3">Durasi Lembur</th>
                  <th className="px-6 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((r) => {
                  const checkInTime = r.checkIn ? new Date(r.checkIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
                  const checkOutTime = r.checkOut ? new Date(r.checkOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
                  const hours = parseFloat(String(r.overtimeHours || '0'));

                  return (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                        {r.date}
                      </td>
                      {isManagerOrAdmin && (
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{r.employeeName}</div>
                            <div className="text-xs text-gray-400">NIP: {r.employeeNip}</div>
                          </div>
                        </td>
                      )}
                      {isManagerOrAdmin && (
                        <td className="px-6 py-4 text-gray-600">
                          {r.departmentName}
                        </td>
                      )}
                      <td className="px-6 py-4 font-mono text-xs">{checkInTime}</td>
                      <td className="px-6 py-4 font-mono text-xs">{checkOutTime}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                          <Clock className="h-3 w-3" />
                          {hours.toFixed(2)} jam
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs max-w-xs truncate">
                        {r.notes || 'Lembur otomatis setelah akhir shift'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
