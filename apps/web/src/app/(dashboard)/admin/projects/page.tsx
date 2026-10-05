'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error';
import { formatRupiah, formatCompact, formatRupiahNumber } from '@/lib/formatCurrency';
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
  Search,
  Wallet,
  Receipt,
  ArrowRight,
  Sliders,
  X,
  CheckCircle2,
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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'planning' | 'on_hold' | 'completed'>('all');

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

      if (['super_admin', 'hr_admin'].includes(user?.role || '')) {
        try {
          const uRes = await api.get<{ data: UserSummary[] }>('/auth/users');
          const usersData = uRes.data.data || [];
          setManagerUsers(usersData.filter((u) => ['manager', 'hr_admin', 'super_admin'].includes(u.role)));
        } catch {
          // ignore error listing users
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Gagal memuat daftar portofolio proyek perusahaan.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Executive summary metrics calculation
  const summaryMetrics = useMemo(() => {
    let totalPortfolioBudget = 0;
    let totalLaborSpent = 0;
    let totalOpexSpent = 0;
    let totalPortfolioSpent = 0;

    for (const p of projectsList) {
      totalPortfolioBudget += parseFloat(String(p.totalBudget || '0'));
      totalLaborSpent += parseFloat(String(p.spentLabor || '0'));
      totalOpexSpent += parseFloat(String(p.spentOperational || '0'));
      totalPortfolioSpent += p.totalSpent || 0;
    }

    const remainingPortfolioBudget = Math.max(0, totalPortfolioBudget - totalPortfolioSpent);
    const averageUtilization = totalPortfolioBudget > 0
      ? Math.round((totalPortfolioSpent / totalPortfolioBudget) * 1000) / 10
      : 0;

    return {
      totalPortfolioBudget,
      totalLaborSpent,
      totalOpexSpent,
      totalPortfolioSpent,
      remainingPortfolioBudget,
      averageUtilization,
    };
  }, [projectsList]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projectsList.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.clientName && p.clientName.toLowerCase().includes(q)) ||
        (p.managerEmail && p.managerEmail.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [projectsList, statusFilter, searchQuery]);

  // Count per status
  const statusCounts = useMemo(() => {
    return {
      all: projectsList.length,
      active: projectsList.filter((p) => p.status === 'active').length,
      planning: projectsList.filter((p) => p.status === 'planning').length,
      on_hold: projectsList.filter((p) => p.status === 'on_hold').length,
      completed: projectsList.filter((p) => p.status === 'completed').length,
    };
  }, [projectsList]);

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
    // Clean trailing decimals like .00 from raw database numbers
    const cleanTotal = item.totalBudget != null && item.totalBudget !== '' ? String(Math.round(Number(item.totalBudget))) : '';
    const cleanLabor = item.laborBudget != null && item.laborBudget !== '' ? String(Math.round(Number(item.laborBudget))) : '';
    const cleanOpex = item.operationalBudget != null && item.operationalBudget !== '' ? String(Math.round(Number(item.operationalBudget))) : '';
    setTotalBudget(cleanTotal);
    setLaborBudget(cleanLabor);
    setOperationalBudget(cleanOpex);
    setStartDate(item.startDate ? item.startDate.split('T')[0] : '');
    setEndDate(item.endDate ? item.endDate.split('T')[0] : '');
    setStatus(item.status);
    setFormError('');
    setShowModal(true);
  };

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  // Helper for interactive ratio splits
  const applyPresetSplit = (laborPct: number, opexPct: number) => {
    const totalNum = parseFloat(totalBudget) || 0;
    if (totalNum <= 0) return;
    const laborVal = Math.round((totalNum * laborPct) / 100);
    const opexVal = totalNum - laborVal;
    setLaborBudget(String(laborVal));
    setOperationalBudget(String(opexVal));
  };

  // Calculate current ratio to highlight active preset
  const currentRatio = useMemo(() => {
    const totalNum = parseFloat(totalBudget) || 0;
    const laborNum = parseFloat(laborBudget) || 0;
    if (totalNum <= 0 || laborNum <= 0) return null;
    return Math.round((laborNum / totalNum) * 100);
  }, [totalBudget, laborBudget]);

  // Auto balance difference
  const autoBalanceTotal = () => {
    const laborNum = parseFloat(laborBudget) || 0;
    const opexNum = parseFloat(operationalBudget) || 0;
    setTotalBudget(String(laborNum + opexNum));
  };

  const budgetDiscrepancy = useMemo(() => {
    const totalNum = parseFloat(totalBudget) || 0;
    const laborNum = parseFloat(laborBudget) || 0;
    const opexNum = parseFloat(operationalBudget) || 0;
    return totalNum - (laborNum + opexNum);
  }, [totalBudget, laborBudget, operationalBudget]);

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'hr_admin':
        return 'HR Admin';
      case 'manager':
        return 'Project Manager';
      default:
        return role;
    }
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
    if (!confirm(`Hapus proyek "${projName}"? Data alokasi tim dan pengeluaran terkait akan dihapus.`)) return;
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

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'active':
        return 'Sedang Berjalan';
      case 'planning':
        return 'Perencanaan';
      case 'on_hold':
        return 'Ditunda';
      case 'completed':
        return 'Selesai';
      default:
        return st;
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-blue-700" />
            Portofolio & Alokasi Anggaran Proyek
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Pantau pagu anggaran per proyek klien, alokasi beban gaji tenaga kerja (labor costing), dan pengeluaran operasional secara real-time.
          </p>
        </div>

        {['super_admin', 'hr_admin'].includes(user?.role || '') && (
          <button
            onClick={openAddModal}
            className="btn btn-primary flex items-center gap-2 text-sm self-start sm:self-auto shrink-0 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Proyek Baru
          </button>
        )}
      </div>

      {/* Portfolio Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Budget */}
        <div className="rounded-[12px] border-[0.5px] border-gray-200/90 bg-white p-4 shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <span>Total Pagu Portofolio</span>
              <Wallet className="h-4 w-4 text-gray-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${summaryMetrics.totalPortfolioBudget === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
              {formatRupiah(summaryMetrics.totalPortfolioBudget)}
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
            <span>
              {projectsList.length === 0
                ? 'Belum ada proyek terdaftar'
                : `${projectsList.length} proyek terdaftar`}
            </span>
          </div>
        </div>

        {/* Realization Labor */}
        <div className="rounded-[12px] border-[0.5px] border-gray-200/90 bg-white p-4 shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <span>Realisasi SDM (Labor)</span>
              <Users className="h-4 w-4 text-gray-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${summaryMetrics.totalLaborSpent === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
              {formatRupiah(summaryMetrics.totalLaborSpent)}
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-3">
            {summaryMetrics.totalLaborSpent === 0
              ? 'Belum ada pembebanan gaji'
              : 'Akumulasi pembebanan gaji tim proyek'}
          </div>
        </div>

        {/* Realization OPEX */}
        <div className="rounded-[12px] border-[0.5px] border-gray-200/90 bg-white p-4 shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <span>Realisasi OPEX (Langsung)</span>
              <Receipt className="h-4 w-4 text-gray-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${summaryMetrics.totalOpexSpent === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
              {formatRupiah(summaryMetrics.totalOpexSpent)}
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-3">
            {summaryMetrics.totalOpexSpent === 0
              ? 'Belum ada pengeluaran operasional'
              : 'Server, lisensi software, travel & perlengkapan'}
          </div>
        </div>

        {/* Remaining Budget & Overall Utilization */}
        <div className="rounded-[12px] border-[0.5px] border-gray-200/90 bg-white p-4 shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <span>Utilisasi Anggaran</span>
              <Sliders className="h-4 w-4 text-gray-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${summaryMetrics.averageUtilization === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
              {summaryMetrics.averageUtilization}%
            </div>
          </div>
          <div>
            <div className="w-full bg-gray-100 rounded-full h-1 mt-2.5 overflow-hidden">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  summaryMetrics.averageUtilization === 0
                    ? 'bg-transparent'
                    : summaryMetrics.averageUtilization >= 95
                    ? 'bg-rose-500'
                    : summaryMetrics.averageUtilization >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(100, summaryMetrics.averageUtilization)}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {formatRupiah(summaryMetrics.remainingPortfolioBudget)} tersisa dari {formatRupiah(summaryMetrics.totalPortfolioBudget)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="rounded-xl border border-gray-200/90 bg-white shadow-sm overflow-hidden">
        {/* Controls: Search & Status Filters */}
        <div className="p-4 border-b border-gray-200 bg-gray-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs font-medium">
            {(
              [
                { id: 'all', label: 'Semua', count: statusCounts.all },
                { id: 'active', label: 'Aktif', count: statusCounts.active },
                { id: 'planning', label: 'Perencanaan', count: statusCounts.planning },
                { id: 'on_hold', label: 'Ditunda', count: statusCounts.on_hold },
                { id: 'completed', label: 'Selesai', count: statusCounts.completed },
              ] as const
            ).map((tab) => {
              const isActive = statusFilter === tab.id;
              const isZero = tab.count === 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-transparent border border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={
                      isZero
                        ? isActive
                          ? 'text-white/50'
                          : 'text-gray-400'
                        : isActive
                        ? 'text-white'
                        : 'text-gray-500'
                    }
                  >
                    ({tab.count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari proyek, kode, klien..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none bg-white"
            />
          </div>
        </div>

        {/* Projects List Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-700 mb-2" />
            <p className="text-sm">Memuat data portofolio proyek...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 text-sm">{error}</div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="p-3 bg-gray-100 rounded-full mb-3 text-gray-400">
              <Briefcase className="h-8 w-8" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">
              {searchQuery || statusFilter !== 'all'
                ? 'Tidak ada proyek yang sesuai filter'
                : 'Belum ada proyek yang dibuat'}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mt-1 mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'Coba sesuaikan kata kunci pencarian atau ganti filter status proyek.'
                : 'Buat proyek perdana untuk mulai mengalokasikan pagu anggaran dan tenaga kerja tim.'}
            </p>
            {searchQuery || statusFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="btn btn-outline text-xs"
              >
                Reset Filter
              </button>
            ) : (
              ['super_admin', 'hr_admin'].includes(user?.role || '') && (
                <button onClick={openAddModal} className="btn btn-primary text-xs flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Proyek Baru
                </button>
              )
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3">Nama & Kode Proyek</th>
                  <th className="px-5 py-3">Klien & Manajer</th>
                  <th className="px-5 py-3">Pagu Proyek</th>
                  <th className="px-5 py-3">Realisasi (SDM / OPEX)</th>
                  <th className="px-5 py-3">Sisa & Utilisasi</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredProjects.map((p) => {
                  const totalBudgetNum = parseFloat(String(p.totalBudget || '0'));
                  const laborBudgetNum = parseFloat(String(p.laborBudget || '0'));
                  const opexBudgetNum = parseFloat(String(p.operationalBudget || '0'));
                  const spentLaborNum = parseFloat(String(p.spentLabor || '0'));
                  const spentOpexNum = parseFloat(String(p.spentOperational || '0'));

                  return (
                    <tr key={p.id} className="group hover:bg-gray-50/80 transition-colors">
                      {/* Name & Code */}
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/projects/${p.id}`}
                          className="font-semibold text-gray-900 hover:text-blue-700 flex items-center gap-1.5 group/link"
                        >
                          <span>{p.name}</span>
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover/link:opacity-100 transition-opacity text-blue-700" />
                        </Link>
                        <div className="text-[11px] font-mono text-gray-500 mt-0.5">{p.code}</div>
                      </td>

                      {/* Client & Manager */}
                      <td className="px-5 py-3.5">
                        <div className="text-gray-900 font-medium">{p.clientName || '-'}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[180px]">
                          {p.managerEmail || 'Tanpa Manajer'}
                        </div>
                      </td>

                      {/* Total Budget */}
                      <td className="px-5 py-3.5 font-mono">
                        <div className={`font-semibold ${totalBudgetNum === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                          {formatRupiah(totalBudgetNum)}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          SDM {formatCompact(laborBudgetNum)} · OPEX {formatCompact(opexBudgetNum)}
                        </div>
                      </td>

                      {/* Spent (Labor / OPEX) */}
                      <td className="px-5 py-3.5 font-mono">
                        <div className={`font-semibold ${p.totalSpent === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                          {formatRupiah(p.totalSpent)}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          SDM {formatCompact(spentLaborNum)} · OPEX {formatCompact(spentOpexNum)}
                        </div>
                      </td>

                      {/* Remaining & Utilization */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5 w-full min-w-[120px]">
                          <div className="flex-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                            <div
                              className={`h-1 rounded-full transition-all duration-300 ${
                                p.usagePercentage === 0
                                  ? 'bg-transparent'
                                  : p.usagePercentage >= 100
                                  ? 'bg-rose-500'
                                  : p.usagePercentage >= 85
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-600'
                              }`}
                              style={{ width: `${Math.min(100, p.usagePercentage)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-mono font-medium shrink-0 ${
                              p.usagePercentage === 0 ? 'text-gray-400' : 'text-gray-700'
                            }`}
                          >
                            {p.usagePercentage}%
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${getStatusBadge(
                            p.status
                          )}`}
                        >
                          {getStatusLabel(p.status)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <Link
                            href={`/admin/projects/${p.id}`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Buka Detail Proyek"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                          {['super_admin', 'hr_admin'].includes(user?.role || '') && (
                            <>
                              <button
                                onClick={() => openEditModal(p)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Edit Proyek & Pagu"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {user?.role === 'super_admin' && (
                                <button
                                  onClick={() => handleDelete(p.id, p.name)}
                                  disabled={deletingId === p.id}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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

      {/* Modal Add / Edit Project */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex min-h-full items-center justify-center p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-2xl bg-white rounded-xl border border-gray-200 shadow-2xl flex flex-col max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header - Fixed */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                    {editItem ? 'Edit Pagu & Info Proyek' : 'Tambah Proyek Baru'}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {editItem
                      ? `Perbarui rincian proyek dan alokasi pagu ${editItem.code}`
                      : 'Isi informasi portofolio proyek dan tentukan pagu anggaran'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Tutup (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} id="project-form" className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Group 1: General Info */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Kode Proyek <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full h-9 rounded-lg border border-gray-300 px-3 text-xs font-mono focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Status Proyek
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full h-9 rounded-lg border border-gray-300 px-3 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors cursor-pointer"
                    >
                      <option value="planning">Perencanaan</option>
                      <option value="active">Sedang Berjalan</option>
                      <option value="on_hold">Ditunda</option>
                      <option value="completed">Selesai</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nama Proyek <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Coca Cola ERP Migration"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-9 rounded-lg border border-gray-300 px-3 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Klien / Sponsor
                    </label>
                    <input
                      type="text"
                      placeholder="Nama Klien atau Instansi"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full h-9 rounded-lg border border-gray-300 px-3 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Project Manager
                    </label>
                    <select
                      value={managerUserId}
                      onChange={(e) => setManagerUserId(e.target.value)}
                      className="w-full h-9 rounded-lg border border-gray-300 px-3 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors cursor-pointer"
                    >
                      <option value="">Pilih Manajer Proyek</option>
                      {managerUsers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.email} ({formatRoleLabel(m.role)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Group 2: Budget Allocation Section */}
              <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-200/90 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                  <span className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-blue-700" />
                    Alokasi Pagu Anggaran
                  </span>
                  {totalBudget && parseFloat(totalBudget) > 0 ? (
                    <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {formatRupiah(parseFloat(totalBudget) || 0)}
                    </span>
                  ) : null}
                </div>

                {/* Total Budget Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">
                      Total Pagu Anggaran Proyek (IDR) <span className="text-red-500">*</span>
                    </label>
                    {totalBudget && parseFloat(totalBudget) > 0 && (
                      <span className="text-[11px] font-mono text-gray-500">
                        {formatRupiahNumber(parseFloat(totalBudget))}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-semibold text-gray-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="1000000"
                      step="1000000"
                      placeholder="250000000"
                      value={totalBudget}
                      onChange={(e) => setTotalBudget(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-300 text-xs font-mono focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Quick Split Ratio Presets */}
                {parseFloat(totalBudget) > 0 && (
                  <div className="space-y-2 pt-0.5">
                    <div className="flex items-center justify-between text-[11px] text-gray-600 font-medium">
                      <span>Preset Pembagian Pagu:</span>
                      <span className="text-[10px] text-gray-400">Pilih rasio pembagian</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { labor: 60, opex: 40, label: '60 : 40', title: '60% SDM · 40% OPEX' },
                        { labor: 70, opex: 30, label: '70 : 30', title: '70% SDM · 30% OPEX' },
                        { labor: 50, opex: 50, label: '50 : 50', title: '50% SDM · 50% OPEX' },
                        { labor: 80, opex: 20, label: '80 : 20', title: '80% SDM · 20% OPEX' },
                      ].map((preset) => {
                        const isActive = currentRatio === preset.labor;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => applyPresetSplit(preset.labor, preset.opex)}
                            title={preset.title}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all text-center border cursor-pointer ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50/50'
                            }`}
                          >
                            <div className="font-semibold leading-tight">{preset.label}</div>
                            <div className={`text-[9px] mt-0.5 ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                              SDM : OPEX
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Dual-color Split Bar */}
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-600"></span>
                          SDM ({parseFloat(totalBudget) > 0 ? Math.round(((parseFloat(laborBudget) || 0) / parseFloat(totalBudget)) * 100) : 0}%): {formatRupiah(parseFloat(laborBudget) || 0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
                          OPEX ({parseFloat(totalBudget) > 0 ? Math.round(((parseFloat(operationalBudget) || 0) / parseFloat(totalBudget)) * 100) : 0}%): {formatRupiah(parseFloat(operationalBudget) || 0)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden flex">
                        <div
                          className="bg-blue-600 transition-all duration-200"
                          style={{
                            width: `${
                              parseFloat(totalBudget) > 0
                                ? Math.min(100, Math.round(((parseFloat(laborBudget) || 0) / parseFloat(totalBudget)) * 100))
                                : 0
                            }%`,
                          }}
                        />
                        <div
                          className="bg-slate-400 transition-all duration-200"
                          style={{
                            width: `${
                              parseFloat(totalBudget) > 0
                                ? Math.min(100, Math.round(((parseFloat(operationalBudget) || 0) / parseFloat(totalBudget)) * 100))
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Labor & OPEX Inputs */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-medium text-gray-700">
                        Pagu SDM (Labor)
                      </label>
                      {laborBudget && (
                        <span className="text-[10px] font-mono text-gray-500">
                          {formatRupiah(parseFloat(laborBudget) || 0)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-xs font-semibold text-gray-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="500000"
                        placeholder="150000000"
                        value={laborBudget}
                        onChange={(e) => setLaborBudget(e.target.value)}
                        className="w-full h-8 pl-8 pr-2 rounded-lg border border-gray-300 text-xs font-mono focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors"
                      />
                    </div>
                    {laborBudget && (
                      <div className="text-[10px] text-gray-400 mt-1 font-mono">
                        {formatRupiahNumber(parseFloat(laborBudget) || 0)}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-medium text-gray-700">
                        Pagu OPEX (Operasional)
                      </label>
                      {operationalBudget && (
                        <span className="text-[10px] font-mono text-gray-500">
                          {formatRupiah(parseFloat(operationalBudget) || 0)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-xs font-semibold text-gray-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="500000"
                        placeholder="100000000"
                        value={operationalBudget}
                        onChange={(e) => setOperationalBudget(e.target.value)}
                        className="w-full h-8 pl-8 pr-2 rounded-lg border border-gray-300 text-xs font-mono focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors"
                      />
                    </div>
                    {operationalBudget && (
                      <div className="text-[10px] text-gray-400 mt-1 font-mono">
                        {formatRupiahNumber(parseFloat(operationalBudget) || 0)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Discrepancy or Balanced Indicator */}
                {parseFloat(totalBudget) > 0 && (
                  budgetDiscrepancy !== 0 ? (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="text-[11px]">
                          {budgetDiscrepancy > 0
                            ? `Sisa belum dialokasikan: ${formatRupiahNumber(budgetDiscrepancy)}`
                            : `Alokasi melebihi total sebesar: ${formatRupiahNumber(Math.abs(budgetDiscrepancy))}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={autoBalanceTotal}
                        className="px-2 py-1 text-[10px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 transition-colors shrink-0 cursor-pointer"
                      >
                        Sesuaikan Total
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium pt-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Alokasi pagu SDM dan OPEX sudah seimbang 100%.</span>
                    </div>
                  )
                )}
              </div>

              {/* Group 3: Schedule */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tanggal Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 rounded-lg border border-gray-300 px-3 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Target Selesai
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-9 rounded-lg border border-gray-300 px-3 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white transition-colors"
                  />
                </div>
              </div>
            </form>

            {/* Modal Footer - Sticky */}
            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3.5 bg-gray-50/70 shrink-0">
              <div className="text-[11px] text-gray-500">
                {totalBudget && parseFloat(totalBudget) > 0 ? (
                  <span>
                    Total Pagu: <strong className="font-semibold text-gray-800 font-mono">{formatRupiahNumber(parseFloat(totalBudget))}</strong>
                  </span>
                ) : (
                  <span className="text-gray-400">* Bidang bertanda bintang wajib diisi</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="project-form"
                  disabled={submitting || !name.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1a2638] text-xs font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {editItem ? 'Simpan Perubahan' : 'Buat Proyek'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
