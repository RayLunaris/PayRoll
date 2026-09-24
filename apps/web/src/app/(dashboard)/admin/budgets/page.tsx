'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error';
import { formatRupiah } from '@/lib/csv';
import {
  PieChart,
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  TrendingUp,
  Wallet,
  Briefcase,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface BudgetSummary {
  year: number;
  totalAllocated: number;
  totalSpent: number;
  totalPayrollSpent: number;
  totalProjectSpent: number;
  remainingBudget: number;
  usagePercentage: number;
  statusColor: 'green' | 'yellow' | 'orange' | 'red';
}

interface Budget {
  id: string;
  name: string;
  periodYear: number;
  periodMonth: number | null;
  category: 'payroll' | 'project' | 'department' | 'general';
  departmentId: string | null;
  departmentName?: string | null;
  allocatedAmount: string | number;
  spentAmount: string | number;
  notes: string | null;
  status: 'draft' | 'active' | 'closed' | 'exceeded';
  createdAt?: string;
}

interface Department {
  id: string;
  name: string;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin'];

export default function AdminBudgetsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [budgetsList, setBudgetsList] = useState<Budget[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form modal state
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Budget | null>(null);
  const [name, setName] = useState('');
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState<string>('');
  const [category, setCategory] = useState<'payroll' | 'project' | 'department' | 'general'>('payroll');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'closed'>('active');
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
      const [sumRes, listRes, deptRes] = await Promise.all([
        api.get<{ data: BudgetSummary }>(`/budgets/summary?year=${selectedYear}`),
        api.get<{ data: Budget[] }>(`/budgets?year=${selectedYear}`),
        api.get<{ data: Department[] }>('/departments'),
      ]);
      setSummary(sumRes.data.data);
      setBudgetsList(listRes.data.data || []);
      setDepartments(deptRes.data.data || []);
    } catch (err) {
      console.error('Failed to load budgets data:', err);
      setError('Gagal memuat data anggaran perusahaan.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openAddModal = () => {
    setEditItem(null);
    setName('');
    setPeriodYear(selectedYear);
    setPeriodMonth('');
    setCategory('payroll');
    setDepartmentId('');
    setAllocatedAmount('');
    setNotes('');
    setStatus('active');
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (item: Budget) => {
    setEditItem(item);
    setName(item.name);
    setPeriodYear(item.periodYear);
    setPeriodMonth(item.periodMonth ? String(item.periodMonth) : '');
    setCategory(item.category);
    setDepartmentId(item.departmentId || '');
    setAllocatedAmount(String(item.allocatedAmount || ''));
    setNotes(item.notes || '');
    setStatus(item.status === 'exceeded' ? 'active' : item.status);
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
        periodYear: Number(periodYear),
        periodMonth: periodMonth ? parseInt(periodMonth, 10) : null,
        category,
        departmentId: category === 'department' && departmentId ? departmentId : null,
        allocatedAmount: parseFloat(allocatedAmount) || 0,
        notes: notes.trim() || null,
        status,
      };

      if (editItem) {
        await api.put(`/budgets/${editItem.id}`, payload);
      } else {
        await api.post('/budgets', payload);
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save budget:', err);
      setFormError(getApiErrorMessage(err, 'Gagal menyimpan alokasi anggaran.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, budgetName: string) => {
    if (!confirm(`Hapus alokasi anggaran "${budgetName}"?`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/budgets/${id}`);
      await loadData();
    } catch (err) {
      console.error('Failed to delete budget:', err);
      alert(getApiErrorMessage(err, 'Gagal menghapus anggaran.'));
    } finally {
      setDeletingId(null);
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
            <PieChart className="h-6 w-6 text-blue-600" />
            Sistem Anggaran & Kontrol Finansial
          </h1>
          <p className="text-gray-500 mt-1">
            Pantau pagu anggaran perusahaan, realisasi beban gaji rutin, dan alokasi biaya operasional proyek.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-gray-300 p-2 text-sm bg-white font-medium focus:border-blue-500 focus:outline-none"
          >
            {[2024, 2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>
                Tahun {yr}
              </option>
            ))}
          </select>

          {user?.role === 'super_admin' && (
            <button
              onClick={openAddModal}
              className="btn btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Pagu Anggaran Baru
            </button>
          )}
        </div>
      </div>

      {/* Executive KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5 bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>Total Pagu Anggaran</span>
                <Wallet className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono">
                {formatRupiah(summary.totalAllocated)}
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <span>Tahun Anggaran {summary.year}</span>
            </div>
          </div>

          <div className="card p-5 bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>Realisasi Gaji (YTD)</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-700 font-mono">
                {formatRupiah(summary.totalPayrollSpent)}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-3">
              {summary.totalAllocated > 0
                ? `${Math.round((summary.totalPayrollSpent / summary.totalAllocated) * 100)}% dari total pagu`
                : 'Belum ada data'}
            </div>
          </div>

          <div className="card p-5 bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>Realisasi Proyek (YTD)</span>
                <Briefcase className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-indigo-700 font-mono">
                {formatRupiah(summary.totalProjectSpent)}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-3">
              {summary.totalAllocated > 0
                ? `${Math.round((summary.totalProjectSpent / summary.totalAllocated) * 100)}% dari total pagu`
                : 'Belum ada data'}
            </div>
          </div>

          <div className="card p-5 bg-white border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
                <span>Sisa Anggaran Bebas</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColorBadge(
                    summary.statusColor
                  )}`}
                >
                  {summary.usagePercentage}% Terpakai
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono">
                {formatRupiah(summary.remainingBudget)}
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  summary.statusColor === 'red'
                    ? 'bg-rose-500'
                    : summary.statusColor === 'orange'
                    ? 'bg-orange-500'
                    : summary.statusColor === 'yellow'
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, summary.usagePercentage)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Budgets List Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            Daftar Alokasi Pagu Anggaran
          </h2>
          <span className="text-xs text-gray-500">
            {budgetsList.length} pos anggaran terdaftar
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Memuat data anggaran...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">{error}</div>
        ) : budgetsList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <PieChart className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-700">Belum ada pagu anggaran untuk tahun {selectedYear}</p>
            <p className="text-xs text-gray-400 mt-1">
              Klik &quot;Pagu Anggaran Baru&quot; untuk menetapkan pagu pertama.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-700">
                <tr>
                  <th className="px-6 py-3.5">Nama Pos Anggaran</th>
                  <th className="px-6 py-3.5">Kategori / Dept</th>
                  <th className="px-6 py-3.5">Periode</th>
                  <th className="px-6 py-3.5">Pagu Anggaran</th>
                  <th className="px-6 py-3.5">Realisasi Pengeluaran</th>
                  <th className="px-6 py-3.5">Sisa Saldo</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budgetsList.map((b) => {
                  const allocated = parseFloat(String(b.allocatedAmount || '0'));
                  const spent = parseFloat(String(b.spentAmount || '0'));
                  const remaining = Math.max(0, allocated - spent);
                  const usagePercent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;

                  return (
                    <tr key={b.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{b.name}</div>
                        {b.notes && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{b.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                            {b.category}
                          </span>
                          {b.departmentName && (
                            <span className="text-[11px] text-gray-500">{b.departmentName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-700">
                        {b.periodMonth ? `Bulan ${b.periodMonth} / ${b.periodYear}` : `Tahunan ${b.periodYear}`}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-gray-900">
                        {formatRupiah(allocated)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        <span className="font-semibold text-rose-600">{formatRupiah(spent)}</span>
                        <span className="text-gray-400 ml-1.5 font-sans">({usagePercent}%)</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-emerald-700">
                        {formatRupiah(remaining)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user?.role === 'super_admin' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(b)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit Alokasi"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(b.id, b.name)}
                              disabled={deletingId === b.id || spent > 0}
                              className={`p-1.5 rounded-lg transition-colors ${
                                spent > 0
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-gray-500 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title={
                                spent > 0
                                  ? 'Tidak dapat dihapus karena sudah ada realisasi pengeluaran'
                                  : 'Hapus Pos Anggaran'
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-lg p-6 bg-white shadow-xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-600" />
                {editItem ? 'Edit Pagu Anggaran' : 'Buat Pagu Anggaran Baru'}
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
                  Nama Pos Anggaran *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Anggaran Penggajian Rutin 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Tahun Anggaran *
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max="2030"
                    value={periodYear}
                    onChange={(e) => setPeriodYear(parseInt(e.target.value, 10) || selectedYear)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Bulan (Opsional)
                  </label>
                  <select
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">Sepanjang Tahun (Tahunan)</option>
                    {[
                      'Januari',
                      'Februari',
                      'Maret',
                      'April',
                      'Mei',
                      'Juni',
                      'Juli',
                      'Agustus',
                      'September',
                      'Oktober',
                      'November',
                      'Desember',
                    ].map((mName, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        Bulan {idx + 1} ({mName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Kategori Pos *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white capitalize"
                  >
                    <option value="payroll">Gaji & Remunerasi (Payroll)</option>
                    <option value="project">Alokasi Proyek (Project)</option>
                    <option value="department">Operasional Departemen</option>
                    <option value="general">Umum & Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Departemen Terikat
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
                    disabled={category !== 'department'}
                  >
                    <option value="">Semua Departemen</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Nominal Alokasi Pagu (IDR) *
                </label>
                <input
                  type="number"
                  min="1000000"
                  step="1000000"
                  placeholder="2400000000"
                  value={allocatedAmount}
                  onChange={(e) => setAllocatedAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Justifikasi penetapan anggaran..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                  {editItem ? 'Simpan Perubahan' : 'Tetapkan Pagu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
