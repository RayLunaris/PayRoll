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
  TrendingUp,
} from 'lucide-react';

interface Position {
  id: string;
  name: string;
  description: string | null;
  baseSalary: string | number;
  grade: string | null;
  createdAt?: string;
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
  const [description, setDescription] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [grade, setGrade] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    // Deferred so state updates are not synchronous with the effect body.
    const timer = window.setTimeout(() => {
      void fetchPositions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPositions]);

  const openAddModal = () => {
    setEditItem(null);
    setName('');
    setDescription('');
    setBaseSalary('');
    setGrade('');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (pos: Position) => {
    setEditItem(pos);
    setName(pos.name);
    setDescription(pos.description || '');
    setBaseSalary(String(pos.baseSalary || ''));
    setGrade(pos.grade || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        baseSalary: parseFloat(baseSalary) || 0,
        grade: grade.trim() || undefined,
      };

      if (editItem) {
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
            Manajemen Jabatan & Posisi
          </h1>
          <p className="text-gray-500 mt-1">
            Kelola standar jabatan, jenjang karir (grade), dan acuan gaji pokok perusahaan.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="btn btn-primary flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Tambah Jabatan
        </button>
      </div>

      {/* Positions Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-600" />
            Daftar Jabatan Perusahaan
          </h2>
          <span className="text-xs text-gray-500">
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
              Klik &quot;Tambah Jabatan&quot; untuk membuat jabatan baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-700">
                <tr>
                  <th className="px-6 py-3">Nama Jabatan</th>
                  <th className="px-6 py-3">Grade</th>
                  <th className="px-6 py-3">Gaji Pokok Acuan</th>
                  <th className="px-6 py-3">Deskripsi</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {positions.map((pos) => {
                  const salaryNum = parseFloat(String(pos.baseSalary || '0'));

                  return (
                    <tr key={pos.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {pos.name}
                      </td>
                      <td className="px-6 py-4">
                        {pos.grade ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                            Grade {pos.grade}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-emerald-700">
                        {formatRupiah(salaryNum)}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 max-w-sm">
                        {pos.description || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 bg-white shadow-xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                {editItem ? 'Edit Jabatan' : 'Tambah Jabatan Baru'}
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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Nama Jabatan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Senior Software Engineer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Grade / Level
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: III-A, L4"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Gaji Pokok (IDR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    placeholder="8000000"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Deskripsi Jabatan
                </label>
                <textarea
                  rows={3}
                  placeholder="Deskripsi tugas dan tanggung jawab jabatan..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
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
                  {editItem ? 'Simpan Perubahan' : 'Simpan Jabatan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
