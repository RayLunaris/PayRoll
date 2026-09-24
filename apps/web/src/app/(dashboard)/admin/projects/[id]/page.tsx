'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error';
import { formatRupiah } from '@/lib/csv';
import {
  Briefcase,
  Users,
  Receipt,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Wallet,
  TrendingUp,
  Percent,
} from 'lucide-react';

interface ProjectMember {
  id: string;
  projectId: string;
  employeeId: string;
  employeeNip: string | null;
  employeeName: string | null;
  roleInProject: string;
  allocationPercentage: string | number;
  assignedMonthlyCost: string | number;
  startDate: string;
  endDate: string | null;
}

interface ProjectExpense {
  id: string;
  projectId: string;
  expenseTitle: string;
  category: 'cloud_server' | 'license' | 'travel' | 'equipment' | 'other';
  amount: string | number;
  expenseDate: string;
  receiptUrl: string | null;
  submittedByEmail: string | null;
  status: string;
}

interface ProjectDetail {
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
  startDate: string;
  endDate: string | null;
  status: string;
  members: ProjectMember[];
  expenses: ProjectExpense[];
}

interface EmployeeSummary {
  id: string;
  nip: string;
  fullName: string;
  baseSalary: number;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin', 'manager'];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [employeesList, setEmployeesList] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Member modal state
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberEmployeeId, setMemberEmployeeId] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [memberAllocation, setMemberAllocation] = useState('100');
  const [memberMonthlyCost, setMemberMonthlyCost] = useState('');
  const [memberStartDate, setMemberStartDate] = useState('');
  const [memberEndDate, setMemberEndDate] = useState('');
  const [submittingMember, setSubmittingMember] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<'cloud_server' | 'license' | 'travel' | 'equipment' | 'other'>('cloud_server');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const loadProject = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    setError('');
    try {
      const [projRes, empRes] = await Promise.all([
        api.get<{ data: ProjectDetail }>(`/projects/${params.id}`),
        api.get<{ data: EmployeeSummary[] }>('/employees'),
      ]);
      setProject(projRes.data.data);
      setEmployeesList(empRes.data.data || []);
    } catch (err) {
      console.error('Failed to load project details:', err);
      setError('Gagal memuat rincian proyek.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const handleSelectEmployee = (eId: string) => {
    setMemberEmployeeId(eId);
    const emp = employeesList.find((e) => e.id === eId);
    if (emp) {
      const salary = parseFloat(String(emp.baseSalary || '0'));
      const allocPct = parseFloat(memberAllocation) || 100;
      setMemberMonthlyCost(String(Math.round((salary * allocPct) / 100)));
    }
  };

  const handleAllocationChange = (pctStr: string) => {
    setMemberAllocation(pctStr);
    const emp = employeesList.find((e) => e.id === memberEmployeeId);
    if (emp) {
      const salary = parseFloat(String(emp.baseSalary || '0'));
      const allocPct = parseFloat(pctStr) || 100;
      setMemberMonthlyCost(String(Math.round((salary * allocPct) / 100)));
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmployeeId || !memberRole.trim() || !memberStartDate) return;

    setSubmittingMember(true);
    setMemberError('');

    try {
      await api.post(`/projects/${params.id}/members`, {
        employeeId: memberEmployeeId,
        roleInProject: memberRole.trim(),
        allocationPercentage: parseFloat(memberAllocation) || 100,
        assignedMonthlyCost: parseFloat(memberMonthlyCost) || 0,
        startDate: memberStartDate,
        endDate: memberEndDate || null,
      });

      setShowMemberModal(false);
      await loadProject();
    } catch (err) {
      console.error('Failed to assign member:', err);
      setMemberError(getApiErrorMessage(err, 'Gagal menugaskan anggota tim.'));
    } finally {
      setSubmittingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName?: string) => {
    if (!confirm(`Hapus penugasan ${memberName || 'anggota'} dari proyek ini?`)) return;
    try {
      await api.delete(`/projects/${params.id}/members/${memberId}`);
      await loadProject();
    } catch (err) {
      console.error('Failed to remove member:', err);
      alert(getApiErrorMessage(err, 'Gagal menghapus anggota tim.'));
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount || !expenseDate) return;

    setSubmittingExpense(true);
    setExpenseError('');

    try {
      await api.post(`/projects/${params.id}/expenses`, {
        expenseTitle: expenseTitle.trim(),
        category: expenseCategory,
        amount: parseFloat(expenseAmount) || 0,
        expenseDate,
      });

      setShowExpenseModal(false);
      setExpenseTitle('');
      setExpenseAmount('');
      await loadProject();
    } catch (err) {
      console.error('Failed to add expense:', err);
      setExpenseError(getApiErrorMessage(err, 'Gagal mencatat pengeluaran.'));
    } finally {
      setSubmittingExpense(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Memuat detail proyek...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="card p-8 text-center text-red-600 space-y-3">
        <p>{error || 'Proyek tidak ditemukan'}</p>
        <Link href="/admin/projects" className="btn btn-outline text-sm">
          Kembali ke Daftar Proyek
        </Link>
      </div>
    );
  }

  const totalBudgetNum = parseFloat(String(project.totalBudget || '0'));
  const spentLaborNum = parseFloat(String(project.spentLabor || '0'));
  const spentOpexNum = parseFloat(String(project.spentOperational || '0'));
  const remainingBudget = Math.max(0, totalBudgetNum - project.totalSpent);

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/projects"
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors text-gray-600"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold border border-blue-200">
                {project.code}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Klien: <span className="font-semibold text-gray-800">{project.clientName || '-'}</span> | Manajer: <span className="font-semibold text-gray-800">{project.managerEmail || '-'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['super_admin', 'hr_admin'].includes(user?.role || '') && (
            <button
              onClick={() => {
                setMemberEmployeeId('');
                setMemberRole('');
                setMemberAllocation('100');
                setMemberMonthlyCost('');
                setMemberStartDate(project.startDate);
                setMemberEndDate(project.endDate || '');
                setMemberError('');
                setShowMemberModal(true);
              }}
              className="btn btn-primary flex items-center gap-1.5 text-xs"
            >
              <Users className="h-3.5 w-3.5" />
              Tugaskan Tim
            </button>
          )}

          <button
            onClick={() => {
              setExpenseTitle('');
              setExpenseCategory('cloud_server');
              setExpenseAmount('');
              setExpenseDate(new Date().toISOString().split('T')[0]);
              setExpenseError('');
              setShowExpenseModal(true);
            }}
            className="btn btn-outline flex items-center gap-1.5 text-xs"
          >
            <Receipt className="h-3.5 w-3.5" />
            Catat Biaya OPEX
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500 font-semibold uppercase">Total Pagu Proyek</span>
          <div className="text-xl font-bold text-gray-900 font-mono mt-1">
            {formatRupiah(totalBudgetNum)}
          </div>
          <div className="text-[11px] text-gray-400 mt-2">
            Labor: {formatRupiah(parseFloat(String(project.laborBudget || '0')))} | OPEX:{' '}
            {formatRupiah(parseFloat(String(project.operationalBudget || '0')))}
          </div>
        </div>

        <div className="card p-4 bg-white border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500 font-semibold uppercase">Realisasi SDM (Labor)</span>
          <div className="text-xl font-bold text-rose-600 font-mono mt-1">
            {formatRupiah(spentLaborNum)}
          </div>
          <div className="text-[11px] text-gray-400 mt-2">Beban gaji dialokasikan</div>
        </div>

        <div className="card p-4 bg-white border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500 font-semibold uppercase">Realisasi OPEX (Langsung)</span>
          <div className="text-xl font-bold text-amber-600 font-mono mt-1">
            {formatRupiah(spentOpexNum)}
          </div>
          <div className="text-[11px] text-gray-400 mt-2">Server, lisensi, travel, vendor</div>
        </div>

        <div className="card p-4 bg-white border border-gray-100 shadow-sm">
          <span className="text-xs text-gray-500 font-semibold uppercase">Sisa Kuota Anggaran</span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
            {formatRupiah(remainingBudget)}
          </div>
          <div className="text-[11px] text-gray-500 mt-2 font-medium">
            Penyerapan: {project.usagePercentage}%
          </div>
        </div>
      </div>

      {/* Two-Column Section: Team Members & Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Members List */}
        <div className="card overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-3.5 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Alokasi Anggota Tim ({project.members.length})
            </h3>
          </div>

          {project.members.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              Belum ada anggota tim yang ditugaskan ke proyek ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50/70 uppercase font-semibold text-[11px] text-gray-700">
                  <tr>
                    <th className="px-4 py-2.5">Karyawan</th>
                    <th className="px-4 py-2.5">Peran</th>
                    <th className="px-4 py-2.5">Alokasi & Biaya/Bulan</th>
                    <th className="px-4 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {project.members.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{m.employeeName}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{m.employeeNip}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                          {m.roleInProject}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <div className="font-semibold text-gray-900">
                          {formatRupiah(parseFloat(String(m.assignedMonthlyCost || '0')))}
                        </div>
                        <div className="text-[10px] text-gray-400">{m.allocationPercentage}% waktu</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {['super_admin', 'hr_admin'].includes(user?.role || '') && (
                          <button
                            onClick={() => handleRemoveMember(m.id, m.employeeName || undefined)}
                            className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Hapus Penugasan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expenses List */}
        <div className="card overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-3.5 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-600" />
              Biaya Operasional Langsung ({project.expenses.length})
            </h3>
          </div>

          {project.expenses.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              Belum ada beban operasional langsung yang dicatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50/70 uppercase font-semibold text-[11px] text-gray-700">
                  <tr>
                    <th className="px-4 py-2.5">Judul Pengeluaran</th>
                    <th className="px-4 py-2.5">Kategori</th>
                    <th className="px-4 py-2.5">Nominal</th>
                    <th className="px-4 py-2.5">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {project.expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{exp.expenseTitle}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          {exp.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-rose-700">
                        {formatRupiah(parseFloat(String(exp.amount || '0')))}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(exp.expenseDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Add Member */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-md p-6 bg-white shadow-xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Tugaskan Anggota ke Proyek
              </h3>
              <button
                onClick={() => setShowMemberModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              {memberError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{memberError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Pilih Karyawan *
                </label>
                <select
                  value={memberEmployeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
                  required
                >
                  <option value="">Pilih Karyawan</option>
                  {employeesList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.nip}) - Gaji Rp {Number(emp.baseSalary).toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Peran dalam Proyek *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Lead Developer, QA Tester"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Bobot Alokasi (%)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    step="10"
                    value={memberAllocation}
                    onChange={(e) => handleAllocationChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Beban Gaji/Bln (IDR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={memberMonthlyCost}
                    onChange={(e) => setMemberMonthlyCost(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Mulai Penugasan *
                  </label>
                  <input
                    type="date"
                    value={memberStartDate}
                    onChange={(e) => setMemberStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Selesai Penugasan
                  </label>
                  <input
                    type="date"
                    value={memberEndDate}
                    onChange={(e) => setMemberEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="btn btn-outline text-sm"
                  disabled={submittingMember}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingMember || !memberEmployeeId || !memberRole.trim()}
                  className="btn btn-primary flex items-center gap-1.5 text-sm"
                >
                  {submittingMember ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Tugaskan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Expense */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-md p-6 bg-white shadow-xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-amber-600" />
                Catat Pengeluaran Operasional
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              {expenseError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{expenseError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Deskripsi / Judul Pengeluaran *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Lisensi JetBrains 5 Kursi"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Kategori *
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="cloud_server">Server & Cloud</option>
                    <option value="license">Lisensi Software</option>
                    <option value="travel">Perjalanan & Akomodasi</option>
                    <option value="equipment">Perangkat Kerja</option>
                    <option value="other">Lain-lain</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Tanggal Biaya *
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Nominal Biaya (IDR) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="50000"
                  placeholder="2500000"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="btn btn-outline text-sm"
                  disabled={submittingExpense}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense || !expenseTitle.trim() || !expenseAmount}
                  className="btn btn-primary flex items-center gap-1.5 text-sm"
                >
                  {submittingExpense ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Biaya
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
