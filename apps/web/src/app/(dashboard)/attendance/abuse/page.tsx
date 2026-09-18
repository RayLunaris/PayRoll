'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Search,
  Filter,
  Loader2,
  RefreshCw,
  Eye,
  Check,
} from 'lucide-react';

interface AbuseLog {
  id: string;
  employeeId: string;
  abuseType: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: string;
  isResolved: boolean;
  resolvedAt?: string;
  employeeName?: string;
  employeeNip?: string;
}

const ALLOWED_ROLES = ['super_admin', 'hr_admin', 'manager'];

const ABUSE_TYPE_LABELS: Record<string, string> = {
  gps_spoofing: 'GPS Spoofing / Mock Location',
  abnormal_overtime: 'Pola Lembur Tidak Wajar',
  buddy_punching: 'Titip Absen (Buddy Punching)',
  unusual_location: 'Lokasi Diluar Radius Kerja',
  multiple_devices: 'Login Multi Perangkat',
  frequent_late: 'Keterlambatan Berulang',
};

export default function AbuseDetectionPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [logs, setLogs] = useState<AbuseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchAbuseLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (statusFilter === 'resolved') params.append('isResolved', 'true');
      if (statusFilter === 'unresolved') params.append('isResolved', 'false');

      const url = `/attendance/abuse-logs${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await api.get<{ data: AbuseLog[] }>(url);
      setLogs(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch abuse logs:', err);
      setError('Gagal memuat riwayat deteksi pelanggaran.');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    // Deferred so state updates are not synchronous with the effect body.
    const timer = window.setTimeout(() => {
      void fetchAbuseLogs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAbuseLogs]);

  const handleResolve = async (id: string) => {
    if (!confirm('Tandai pelanggaran ini sebagai telah ditinjau dan diselesaikan?')) return;
    setResolvingId(id);
    try {
      await api.put(`/attendance/abuse-logs/${id}/resolve`);
      await fetchAbuseLogs();
    } catch (err) {
      console.error('Failed to resolve abuse log:', err);
      alert('Gagal menyelesaikan log pelanggaran.');
    } finally {
      setResolvingId(null);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.employeeName?.toLowerCase().includes(q) ||
        l.employeeNip?.toLowerCase().includes(q) ||
        l.abuseType.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q),
    );
  }, [logs, search]);

  const stats = useMemo(() => {
    const total = logs.length;
    const unresolved = logs.filter((l) => !l.isResolved).length;
    const high = logs.filter((l) => l.severity === 'high').length;
    const resolved = logs.filter((l) => l.isResolved).length;
    return { total, unresolved, high, resolved };
  }, [logs]);

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-600" />
            Deteksi Pelanggaran Presensi (Abuse Detection)
          </h1>
          <p className="text-gray-500 mt-1">
            Monitoring otomatis terhadap potensi kecurangan GPS, titip absen, dan anomali lembur.
          </p>
        </div>

        <button
          onClick={fetchAbuseLogs}
          disabled={loading}
          className="btn btn-outline flex items-center gap-1.5 text-sm self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Segarkan Data
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 bg-gradient-to-br from-rose-50 to-white border border-rose-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                Total Pelanggaran
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-rose-600/10 p-3 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">Semua insiden tercatat</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-amber-50 to-white border border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Belum Ditinjau
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.unresolved}</p>
            </div>
            <div className="rounded-xl bg-amber-600/10 p-3 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-amber-700 font-medium">Membutuhkan tindakan HR</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-red-50 to-white border border-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                Keparahan Tinggi (High)
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.high}</p>
            </div>
            <div className="rounded-xl bg-red-600/10 p-3 text-red-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">GPS spoofing / manipulasi</p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Telah Diselesaikan
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.resolved}</p>
            </div>
            <div className="rounded-xl bg-emerald-600/10 p-3 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">Telah diverifikasi oleh HR</p>
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
              aria-label="Filter Keparahan"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Semua Keparahan</option>
              <option value="high">Tinggi (High)</option>
              <option value="medium">Sedang (Medium)</option>
              <option value="low">Rendah (Low)</option>
            </select>

            <select
              aria-label="Filter Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="unresolved">Belum Diselesaikan</option>
              <option value="resolved">Sudah Diselesaikan</option>
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari karyawan, jenis, deskripsi..."
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
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            Log Temuan Pelanggaran
          </h2>
          <span className="text-xs text-gray-500">
            Ditemukan {filteredLogs.length} catatan
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Memuat catatan pelanggaran...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
            <p className="text-base font-medium text-gray-700">Tidak ada pelanggaran terdeteksi</p>
            <p className="text-xs text-gray-400 mt-1">
              Sistem tidak menemukan anomali presensi dengan filter saat ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-700">
                <tr>
                  <th className="px-6 py-3">Waktu Terdeteksi</th>
                  <th className="px-6 py-3">Karyawan</th>
                  <th className="px-6 py-3">Jenis Pelanggaran</th>
                  <th className="px-6 py-3">Deskripsi Temuan</th>
                  <th className="px-6 py-3">Keparahan</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                        {new Date(log.detectedAt).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{log.employeeName || 'Karyawan'}</div>
                        <div className="text-xs text-gray-400">NIP: {log.employeeNip || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-800">
                          {ABUSE_TYPE_LABELS[log.abuseType] || log.abuseType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 max-w-xs">
                        {log.description || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {log.severity === 'high' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 border border-red-200">
                            Tinggi
                          </span>
                        )}
                        {log.severity === 'medium' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                            Sedang
                          </span>
                        )}
                        {log.severity === 'low' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 border border-gray-200">
                            Rendah
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {log.isResolved ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <Check className="h-3 w-3" />
                            Diselesaikan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                            <AlertTriangle className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!log.isResolved ? (
                          <button
                            onClick={() => handleResolve(log.id)}
                            disabled={resolvingId === log.id}
                            className="btn btn-xs btn-primary flex items-center gap-1 ml-auto"
                          >
                            <Check className="h-3 w-3" />
                            Tandai Selesai
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Selesai</span>
                        )}
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
