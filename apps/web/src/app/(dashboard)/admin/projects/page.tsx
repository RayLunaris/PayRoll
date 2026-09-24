'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Loader2,
  AlertCircle,
  ExternalLink,
  Users,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface Project {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  managerUserId: string | null;
  managerEmail: string | null;
  totalBudget: string | number;
  laborBudget: string | number;
  operationalBudget: string | number;
  spentLabor: string | number;
  spentOperational: string | number;
  totalSpent: number;
  remainingBudget: number;
  usagePercentage: number;
  statusColor: 'green' | 'yellow' | 'orange' | 'red';
  startDate: string;
  endDate: string | null;
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  createdAt?: string;
}

interface UserSummary {
  id: string;
  email: string;
  role: string;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin', 'manager'];

export default function AdminProjectsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [managerUsers, setManagerUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form modal state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Project | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [managerUserId, setManagerUserId] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [laborBudget, setLaborBudget] = useState('');
  const [operationalBudget, setOperationalBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'planning' | 'active' | 'completed' | 'on_hold'>('active');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Project[] }>('/projects');
      setProjectsList(res.data.data || []);

      // Load manager candidates if user is admin
      if (['super_admin', 'hr_admin'].includes(user?.role || '')) {
        try {
          const uRes = await api.get<{ data: UserSummary[] }>('/auth/users');
          const usersData = uRes.data.data || [];
          setManagerUsers(usersData.filter((u) => ['manager', 'hr_admin', 'super_admin'].includes(u.role)));
        } catch {
          // ignore if non-admin cannot list users
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Gagal memuat daftar proyek perusahaan.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openAddModal = () => {
    setEditItem(null);
    setCode(`PRJ-${new Date().getFullYear()}-${String(projectsList.length + 1).padStart(3, '0')}`);
    setName('');
    setClientName('');
    setManagerUserId(user?.id || '');
    setTotalBudget('');
    setLaborBudget('');
    setOperationalBudget('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setStatus('active');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (item: Project) => {
    setEditItem(item);
    setCode(item.code);
    setName(item.name);
    setClientName(item.clientName || '');
    setManagerUserId(item.managerUserId || '');
    setTotalBudget(String(item.totalBudget || ''));
    setLaborBudget(String(item.laborBudget || ''));
    setOperationalBudget(String(item.operationalBudget || ''));
    setStartDate(item.startDate);
    setEndDate(item.endDate || '');
    setStatus(item.status);
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !startDate) return;

    setSubmitting(true);
    setFormError('');

    try {
      const totalNum = parseFloat(totalBudget) || 0;
      const laborNum = parseFloat(laborBudget) || 0;
      const opexNum = parseFloat(operationalBudget) || 0;

      const payload = {
        code: code.trim(),
        name: name.trim(),
        clientName: clientName.trim() || null,
        managerUserId: managerUserId || null,
        totalBudget: totalNum,
        laborBudget: laborNum,
        operationalBudget: opexNum,
        startDate,
        endDate: endDate || null,
        status,
      };

      if (editItem) {
        await api.put(`/projects/${editItem.id}`, payload);
      } else {
        await api.post('/projects', payload);
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save project:', err);
      setFormError(getApiErrorMessage(err, 'Gagal menyimpan proyek.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, projName: string) => {
    if (!confirm(`Hapus proyek "${projName}"? Data tim dan pengeluaran terkait akan dihapus.`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/projects/${id}`);
      await loadData();
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert(getApiErrorMessage(err, 'Gagal menghapus proyek.'));
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'on_hold':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusColorBadge = (color?: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'orange':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'yellow':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
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
            Manajemen Proyek & Pembebanan Biaya (Project Costing)
          </h1>
          <p className="text-gray-500 mt-1">
            Alokasikan biaya tenaga kerja (labor costing) dan pantau pengeluaran operasional per proyek klien secara real-time.
          </p>
        </div>

        {['super_admin', 'hr_admin'].includes(user?.role || '') && (
          <button
            onClick={openAddModal}
            className="btn btn-primary flex items-center gap-2 text-sm self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Proyek Baru
          </button>
        )}
      </div>

      {/* Projects Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-600" />
            Daftar Portofolio Proyek
          </h2>
          <span className="text-xs text-gray-500 font-medium">
            Total {projectsList.length} proyek
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Memuat data proyek...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        ) : projectsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Briefcase className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-700">Belum ada proyek yang terdaftar</p>
            <p className="text-xs text-gray-400 mt-1">
              Klik &quot;Proyek Baru&quot; untuk membuat proyek perdana.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-700">
                <tr>
                  <th className="px-6 py-3.5">Kode & Nama Proyek</th>
                  <th className="px-6 py-3.5">Klien / Manajer</th>
                  <th className="px-6 py-3.5">Total Pagu Proyek</th>
                  <th className="px-6 py-3.5">Realisasi (Labor / OPEX)</th>
                  <th className="px-6 py-3.5">Sisa & Utilisasi</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projectsList.map((p) => {
                  const totalBudgetNum = parseFloat(String(p.totalBudget || '0'));
                  const spentLaborNum = parseFloat(String(p.spentLabor || '0'));
                  const spentOpexNum = parseFloat(String(p.spentOperational || '0'));

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/projects/${p.id}`}
                          className="font-semibold text-gray-900 hover:text-blue-600 flex items-center gap-1.5 group"
                        >
                          <span>{p.name}</span>
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                        </Link>
                        <div className="text-xs font-mono text-gray-500 mt-0.5">{p.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-800 font-medium">{p.clientName || '-'}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{p.managerEmail || 'Tanpa Manajer'}</div>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-gray-900">
                        {formatRupiah(totalBudgetNum)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="font-semibold text-rose-600">{formatRupiah(p.totalSpent)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Labor: {formatRupiah(spentLaborNum)} | OPEX: {formatRupiah(spentOpexNum)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-700">
                            {formatRupiah(p.remainingBudget)}
                          </span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${getStatusColorBadge(
                              p.statusColor
                            )}`}
                          >
                            {p.usagePercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${getStatusBadge(
                            p.status
                          )}`}
                        >
                          {p.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/projects/${p.id}`}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Buka Rincian Proyek & Tim"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                          {['super_admin', 'hr_admin'].includes(user?.role || '') && (
                            <>
                              <button
                                onClick={() => openEditModal(p)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Edit Proyek"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {user?.role === 'super_admin' && (
                                <button
                                  onClick={() => handleDelete(p.id, p.name)}
                                  disabled={deletingId === p.id}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Hapus Proyek"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
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
                {editItem ? 'Edit Proyek' : 'Tambah Proyek Baru'}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Kode Proyek *
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-mono focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Status Proyek
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="planning">Perencanaan (Planning)</option>
                    <option value="active">Sedang Berjalan (Active)</option>
                    <option value="on_hold">Ditunda (On Hold)</option>
                    <option value="completed">Selesai (Completed)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Nama Proyek *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Portal Pelayanan Publik"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Klien / Sponsor
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Perusahaan Klien"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Project Manager
                  </label>
                  <select
                    value={managerUserId}
                    onChange={(e) => setManagerUserId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">Pilih Manajer</option>
                    {managerUsers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.email} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Total Pagu Anggaran Proyek (IDR) *
                </label>
                <input
                  type="number"
                  min="1000000"
                  step="5000000"
                  placeholder="250000000"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Pagu Biaya SDM (Labor)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="150000000"
                    value={laborBudget}
                    onChange={(e) => setLaborBudget(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Pagu Biaya OPEX (Server/dll)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100000000"
                    value={operationalBudget}
                    onChange={(e) => setOperationalBudget(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Tanggal Mulai *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Target Selesai
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
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
                  {editItem ? 'Simpan Perubahan' : 'Buat Proyek'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
