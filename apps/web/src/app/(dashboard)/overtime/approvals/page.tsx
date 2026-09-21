'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types';
import {
  Check,
  X,
  Clock,
  UserCircle,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface OvertimeRequestItem {
  id: string;
  employeeId: string;
  date: string;
  hours: string | number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes?: string | null;
  createdAt: string;
}

interface EmployeeItem {
  id: string;
  fullName: string;
  nip?: string;
}

const ALLOWED_ROLES: UserRole[] = ['manager', 'hr_admin', 'super_admin'];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function OvertimeApprovalsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [requests, setRequests] = useState<OvertimeRequestItem[]>([]);
  const [employeeMap, setEmployeeMap] = useState<Record<string, EmployeeItem>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Role guard
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role as UserRole)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, empsRes] = await Promise.all([
        api.get<{ data: OvertimeRequestItem[] }>('/attendance/overtime-requests/approvals'),
        api.get<{ data: EmployeeItem[] }>('/employees').catch(() => ({
          data: { data: [] as EmployeeItem[] },
        })),
      ]);

      setRequests(reqRes.data?.data || []);

      if (empsRes.data?.data) {
        const map: Record<string, EmployeeItem> = {};
        empsRes.data.data.forEach((emp) => {
          map[emp.id] = emp;
        });
        setEmployeeMap(map);
      }
    } catch (err) {
      console.error('Failed to fetch overtime approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && ALLOWED_ROLES.includes(user.role as UserRole)) {
      void (async () => {
        await fetchData();
      })();
    }
  }, [user, fetchData]);

  const handleDecision = async (id: string, approved: boolean) => {
    setProcessingId(id);
    setFeedback(null);

    const notes = notesMap[id] || undefined;

    try {
      await api.put(`/attendance/overtime-requests/${id}/approve`, { approved, notes });
      setFeedback({
        type: 'success',
        text: `Pengajuan lembur berhasil ${approved ? 'disetujui' : 'ditolak'}.`,
      });

      setNotesMap((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });

      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg =
        axiosErr.response?.data?.error ||
        `Gagal ${approved ? 'menyetujui' : 'menolak'} pengajuan lembur.`;
      setFeedback({ type: 'error', text: msg });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Persetujuan Lembur</h1>
        <p className="text-gray-500 mt-1">
          Daftar pengajuan lembur yang memerlukan tinjauan dan persetujuan
        </p>
      </div>

      {feedback && (
        <div
          className={`mb-6 flex items-start gap-3 p-4 rounded-lg ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          )}
          <p className="text-sm font-medium">{feedback.text}</p>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="font-medium text-gray-700">Semua Pengajuan Selesai</p>
            <p className="text-sm">
              Tidak ada pengajuan lembur yang menunggu persetujuan saat ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((req) => {
              const emp = employeeMap[req.employeeId];
              const empName = emp?.fullName || 'Karyawan';
              const hours = parseFloat(req.hours.toString());
              const isProcessing = processingId === req.id;

              return (
                <div
                  key={req.id}
                  className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-6 w-6 text-gray-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-gray-900">{empName}</p>
                          {emp?.nip && (
                            <p className="text-xs text-gray-500">NIP: {emp.nip}</p>
                          )}
                        </div>
                      </div>
                      <span className="badge badge-warning flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        Menunggu
                      </span>
                    </div>

                    {/* Jam badge */}
                    <div className="mb-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-100">
                        {hours} jam lembur
                      </span>
                    </div>

                    {/* Detail */}
                    <div className="text-sm text-gray-600 space-y-2 mb-4 bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-semibold text-gray-800">{formatDate(req.date)}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                        <span className="text-gray-700 italic">
                          &ldquo;{req.reason || 'Tidak ada alasan dicantumkan'}&rdquo;
                        </span>
                      </div>
                    </div>

                    {/* Catatan input */}
                    <div className="mb-4">
                      <label
                        htmlFor={`notes-${req.id}`}
                        className="block text-xs font-medium text-gray-700 mb-1"
                      >
                        Catatan Persetujuan (Opsional)
                      </label>
                      <input
                        id={`notes-${req.id}`}
                        type="text"
                        value={notesMap[req.id] || ''}
                        onChange={(e) =>
                          setNotesMap((prev) => ({
                            ...prev,
                            [req.id]: e.target.value,
                          }))
                        }
                        placeholder="Contoh: Disetujui, pekerjaan urgen"
                        className="input text-xs py-1.5"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>

                  {/* Tombol aksi */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleDecision(req.id, true)}
                      disabled={isProcessing}
                      className="btn btn-success flex-1 py-2 text-sm flex items-center justify-center gap-1.5"
                    >
                      <Check className="h-4 w-4" />
                      {isProcessing ? 'Memproses...' : 'Setujui'}
                    </button>
                    <button
                      onClick={() => handleDecision(req.id, false)}
                      disabled={isProcessing}
                      className="btn btn-danger flex-1 py-2 text-sm flex items-center justify-center gap-1.5"
                    >
                      <X className="h-4 w-4" />
                      {isProcessing ? 'Memproses...' : 'Tolak'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
