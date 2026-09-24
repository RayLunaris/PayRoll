'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error';
import { formatRupiah } from '@/lib/csv';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  AlertCircle,
  History,
  ShieldAlert,
  Layers,
} from 'lucide-react';

interface Position {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  grade: string | null;
  levelRank: number | null;
  baseSalary: string | number;
  minSalary: string | number | null;
  maxSalary: string | number | null;
  positionAllowance: string | number | null;
  createdAt?: string;
}

interface AuditLog {
  id: string;
  positionId: string;
  userEmail: string | null;
  oldBaseSalary: string | number;
  newBaseSalary: string | number;
  oldAllowance: string | number | null;
  newAllowance: string | number | null;
  reason: string;
  createdAt: string;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

export default function PositionsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form modal state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Position | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [grade, setGrade] = useState('Grade 1');
  const [levelRank, setLevelRank] = useState(1);
  const [baseSalary, setBaseSalary] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [positionAllowance, setPositionAllowance] = useState('0');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Audit Logs modal state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedAuditPos, setSelectedAuditPos] = useState<Position | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Position[] }>('/positions');
      setPositions(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch positions:', err);
      setError('Gagal memuat daftar jabatan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPositions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPositions]);

  const openAddModal = () => {
    setEditItem(null);
    setName('');
    setCode('');
    setGrade('Grade 1');
    setLevelRank(1);
    setBaseSalary('');
    setMinSalary('');
    setMaxSalary('');
    setPositionAllowance('0');
    setDescription('');
    setReason('');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (pos: Position) => {
    setEditItem(pos);
    setName(pos.name);
    setCode(pos.code || '');
    setGrade(pos.grade || 'Grade 1');
    setLevelRank(pos.levelRank || 1);
    setBaseSalary(String(pos.baseSalary || ''));
    setMinSalary(pos.minSalary ? String(pos.minSalary) : '');
    setMaxSalary(pos.maxSalary ? String(pos.maxSalary) : '');
    setPositionAllowance(pos.positionAllowance ? String(pos.positionAllowance) : '0');
    setDescription(pos.description || '');
    setReason('');
    setFormError('');
    setShowModal(true);
  };

  const openAuditLogs = async (pos: Position) => {
    setSelectedAuditPos(pos);
    setShowAuditModal(true);
    setAuditLoading(true);
    try {
      const res = await api.get<{ data: AuditLog[] }>(`/positions/${pos.id}/audit-logs`);
      setAuditLogs(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const isSalaryChanged = () => {
    if (!editItem) return false;
    const oldBase = parseFloat(String(editItem.baseSalary || '0'));
    const newBase = parseFloat(baseSalary || '0');
    const oldAllow = parseFloat(String(editItem.positionAllowance || '0'));
    const newAllow = parseFloat(positionAllowance || '0');
    return oldBase !== newBase || oldAllow !== newAllow;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editItem && isSalaryChanged() && !reason.trim()) {
      setFormError('Alasan perubahan skala upah wajib diisi untuk pencatatan audit log.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const payload: any = {
        name: name.trim(),
        code: code.trim() || undefined,
        grade: grade.trim() || undefined,
        levelRank: Number(levelRank) || 1,
        baseSalary: parseFloat(baseSalary) || 0,
        minSalary: minSalary ? parseFloat(minSalary) : undefined,
        maxSalary: maxSalary ? parseFloat(maxSalary) : undefined,
        positionAllowance: parseFloat(positionAllowance) || 0,
        description: description.trim() || undefined,
      };

      if (editItem) {
        if (isSalaryChanged()) {
          payload.reason = reason.trim();
        }
        await api.put(`/positions/${editItem.id}`, payload);
      } else {
        await api.post('/positions', payload);
      }

      setShowModal(false);
      await fetchPositions();
    } catch (err) {
      console.error('Failed to save position:', err);
      setFormError(getApiErrorMessage(err, 'Gagal menyimpan data jabatan.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, posName: string) => {
    if (!confirm(`Hapus jabatan "${posName}"?`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/positions/${id}`);
      await fetchPositions();
    } catch (err) {
      console.error('Failed to delete position:', err);
      alert(getApiErrorMessage(err, 'Gagal menghapus jabatan.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-blue-600" />
            Manajemen Jabatan & Skala Upah
          </h1>
          <p className="text-gray-500 mt-1">
            Standarisasi struktur jabatan, rentang gaji (min-max), tunjangan tetap, dan audit trail perubahan upah.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="btn btn-primary flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Tambah Jabatan Baru
        </button>
      </div>

      {/* Positions Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            Daftar Jabatan Resmi & Struktur Skala Upah
          </h2>
          <span className="text-xs text-gray-500 font-medium">
            Total {positions.length} jabatan terdaftar
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Memuat data jabatan...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        ) : positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Briefcase className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-700">Belum ada jabatan yang ditambahkan</p>
            <p className="text-xs text-gray-400 mt-1">
              Klik &quot;Tambah Jabatan Baru&quot; untuk membuat master jabatan pertama.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-700">
                <tr>
                  <th className="px-6 py-3.5">Nama & Kode Jabatan</th>
                  <th className="px-6 py-3.5">Jenjang / Grade</th>
                  <th className="px-6 py-3.5">Gaji Acuan</th>
                  <th className="px-6 py-3.5">Rentang Gaji (Min - Max)</th>
                  <th className="px-6 py-3.5">Tunjangan Jabatan</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {positions.map((pos) => {
                  const salaryNum = parseFloat(String(pos.baseSalary || '0'));
                  const minNum = pos.minSalary ? parseFloat(String(pos.minSalary)) : null;
                  const maxNum = pos.maxSalary ? parseFloat(String(pos.maxSalary)) : null;
                  const allowanceNum = parseFloat(String(pos.positionAllowance || '0'));

                  return (
                    <tr key={pos.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{pos.name}</div>
                        {pos.code && (
                          <div className="text-xs font-mono text-gray-500 mt-0.5">{pos.code}</div>
                        )}
                        {pos.description && (
                          <div className="text-xs text-gray-400 mt-1 max-w-xs truncate" title={pos.description}>
                            {pos.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                            {pos.grade || 'Grade 1'}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            Rank Level: {pos.levelRank ?? 1}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-emerald-700">
                        {formatRupiah(salaryNum)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        {minNum && maxNum ? (
                          <span>
                            {formatRupiah(minNum)} - {formatRupiah(maxNum)}
                          </span>
                        ) : minNum ? (
                          <span>≥ {formatRupiah(minNum)}</span>
                        ) : maxNum ? (
                          <span>≤ {formatRupiah(maxNum)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-indigo-700 font-medium">
                        {allowanceNum > 0 ? formatRupiah(allowanceNum) : <span className="text-gray-400">Rp 0</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openAuditLogs(pos)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Riwayat Perubahan Gaji (Audit Trail)"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(pos)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit Jabatan"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(pos.id, pos.name)}
                            disabled={deletingId === pos.id}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Hapus Jabatan"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-lg p-6 bg-white shadow-xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                {editItem ? 'Edit Jabatan & Skala Upah' : 'Tambah Jabatan Baru'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Nama Jabatan *
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Senior Backend Engineer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Kode Jabatan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: SE-SR, PM-01"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Jenjang / Grade
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="Grade 1">Grade 1 (Junior/Staff)</option>
                    <option value="Grade 2">Grade 2 (Middle)</option>
                    <option value="Grade 3">Grade 3 (Senior)</option>
                    <option value="Grade 4">Grade 4 (Lead/Principal)</option>
                    <option value="Grade 5">Grade 5 (Manager/Head)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Hierarki Rank Level (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={levelRank}
                    onChange={(e) => setLevelRank(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Gaji Pokok Acuan (IDR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100000"
                    placeholder="8000000"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Tunjangan Jabatan Tetap (IDR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    placeholder="500000"
                    value={positionAllowance}
                    onChange={(e) => setPositionAllowance(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Rentang Min (Batas Bawah)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100000"
                    placeholder="6000000"
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Rentang Max (Batas Atas)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100000"
                    placeholder="10000000"
                    value={maxSalary}
                    onChange={(e) => setMaxSalary(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {editItem && isSalaryChanged() && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-amber-800 text-xs font-semibold">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Wajib Diisi: Alasan Perubahan Skala Gaji (Audit Trail)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Misal: Penyesuaian inflasi tahunan / standar upah baru..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 p-2 text-xs focus:border-amber-500 focus:outline-none bg-white"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Deskripsi & Kualifikasi Jabatan
                </label>
                <textarea
                  rows={2}
                  placeholder="Uraian tugas pokok dan tanggung jawab..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline text-sm"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="btn btn-primary flex items-center gap-1.5 text-sm"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editItem ? 'Simpan Perubahan' : 'Buat Jabatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Audit Logs */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl p-6 bg-white shadow-xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-600" />
                  Riwayat Audit Perubahan Skala Gaji
                </h3>
                {selectedAuditPos && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Jabatan: <span className="font-semibold text-gray-800">{selectedAuditPos.name}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {auditLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                <span className="text-sm text-gray-500">Memuat riwayat audit...</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">
                Belum ada catatan perubahan skala gaji untuk jabatan ini.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-[11px] font-semibold uppercase text-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Waktu</th>
                      <th className="px-4 py-2.5">Diubah Oleh</th>
                      <th className="px-4 py-2.5">Gaji Pokok (Lama → Baru)</th>
                      <th className="px-4 py-2.5">Tunjangan</th>
                      <th className="px-4 py-2.5">Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/70">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                          {new Date(log.createdAt).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {log.userEmail || 'Admin'}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <span className="text-gray-400 line-through mr-1">
                            {formatRupiah(parseFloat(String(log.oldBaseSalary)))}
                          </span>
                          <span className="text-emerald-700 font-semibold">
                            → {formatRupiah(parseFloat(String(log.newBaseSalary)))}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {log.newAllowance ? formatRupiah(parseFloat(String(log.newAllowance))) : 'Rp 0'}
                        </td>
                        <td className="px-4 py-3 italic text-gray-600 max-w-xs">
                          &quot;{log.reason}&quot;
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="btn btn-outline text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
