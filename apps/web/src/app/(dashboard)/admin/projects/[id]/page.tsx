'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Sliders,
  Search,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Server,
  KeyRound,
  Plane,
  Laptop,
  Coins,
  Pencil,
  ArrowRight,
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

interface UserSummary {
  id: string;
  email: string;
  role: string;
}

const ALLOWED_ROLES = ['hr_admin', 'super_admin', 'manager'];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [employeesList, setEmployeesList] = useState<EmployeeSummary[]>([]);
  const [managerUsers, setManagerUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tab navigation: 'members' | 'expenses' | 'breakdown'
  const [activeTab, setActiveTab] = useState<'members' | 'expenses' | 'breakdown'>('members');

  // Workflow guide collapsible
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(true);

  // Search in members and expenses
  const [memberSearch, setMemberSearch] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');

  // Edit Project modal state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editManagerUserId, setEditManagerUserId] = useState('');
  const [editTotalBudget, setEditTotalBudget] = useState('');
  const [editLaborBudget, setEditLaborBudget] = useState('');
  const [editOperationalBudget, setEditOperationalBudget] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState<string>('active');
  const [submittingProjectEdit, setSubmittingProjectEdit] = useState(false);
  const [projectEditError, setProjectEditError] = useState('');

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

      if (['super_admin', 'hr_admin'].includes(user?.role || '')) {
        try {
          const uRes = await api.get<{ data: UserSummary[] }>('/auth/users');
          const usersData = uRes.data.data || [];
          setManagerUsers(usersData.filter((u) => ['manager', 'hr_admin', 'super_admin'].includes(u.role)));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
      setError('Gagal memuat rincian proyek.');
    } finally {
      setLoading(false);
    }
  }, [params.id, user]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  // Selected employee base salary helper
  const selectedEmployee = useMemo(() => {
    return employeesList.find((e) => e.id === memberEmployeeId) || null;
  }, [employeesList, memberEmployeeId]);

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
    if (selectedEmployee) {
      const salary = parseFloat(String(selectedEmployee.baseSalary || '0'));
      const allocPct = parseFloat(pctStr) || 0;
      setMemberMonthlyCost(String(Math.round((salary * allocPct) / 100)));
    }
  };

  // Open Edit Project Modal
  const openEditProject = () => {
    if (!project) return;
    setEditName(project.name);
    setEditCode(project.code);
    setEditClientName(project.clientName || '');
    setEditManagerUserId(project.managerUserId || '');
    setEditTotalBudget(String(project.totalBudget || ''));
    setEditLaborBudget(String(project.laborBudget || ''));
    setEditOperationalBudget(String(project.operationalBudget || ''));
    setEditStartDate(project.startDate);
    setEditEndDate(project.endDate || '');
    setEditStatus(project.status);
    setProjectEditError('');
    setShowEditProjectModal(true);
  };

  const handleSaveProjectEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !editName.trim() || !editCode.trim() || !editStartDate) return;

    setSubmittingProjectEdit(true);
    setProjectEditError('');

    try {
      const totalNum = parseFloat(editTotalBudget) || 0;
      const laborNum = parseFloat(editLaborBudget) || 0;
      const opexNum = parseFloat(editOperationalBudget) || 0;

      await api.put(`/projects/${project.id}`, {
        code: editCode.trim(),
        name: editName.trim(),
        clientName: editClientName.trim() || null,
        managerUserId: editManagerUserId || null,
        totalBudget: totalNum,
        laborBudget: laborNum,
        operationalBudget: opexNum,
        startDate: editStartDate,
        endDate: editEndDate || null,
        status: editStatus,
      });

      setShowEditProjectModal(false);
      await loadProject();
    } catch (err) {
      console.error('Failed to update project:', err);
      setProjectEditError(getApiErrorMessage(err, 'Gagal menyimpan perubahan proyek.'));
    } finally {
      setSubmittingProjectEdit(false);
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-700 mb-2" />
        <p className="text-sm">Memuat detail anggaran proyek...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-8 text-center text-red-600 space-y-3">
        <p className="font-semibold text-sm">{error || 'Proyek tidak ditemukan'}</p>
        <Link href="/admin/projects" className="btn btn-outline text-xs">
          Kembali ke Portofolio Proyek
        </Link>
      </div>
    );
  }

  // Calculated metrics
  const totalBudgetNum = parseFloat(String(project.totalBudget || '0'));
  const laborBudgetNum = parseFloat(String(project.laborBudget || '0'));
  const opexBudgetNum = parseFloat(String(project.operationalBudget || '0'));
  const spentLaborNum = parseFloat(String(project.spentLabor || '0'));
  const spentOpexNum = parseFloat(String(project.spentOperational || '0'));
  const remainingBudget = Math.max(0, totalBudgetNum - project.totalSpent);
  const remainingLabor = Math.max(0, laborBudgetNum - spentLaborNum);
  const remainingOpex = Math.max(0, opexBudgetNum - spentOpexNum);

  const laborUsagePct = laborBudgetNum > 0 ? Math.round((spentLaborNum / laborBudgetNum) * 100) : 0;
  const opexUsagePct = opexBudgetNum > 0 ? Math.round((spentOpexNum / opexBudgetNum) * 100) : 0;

  // Total monthly labor cost run-rate from active members
  const totalMonthlyLaborRate = project.members.reduce(
    (sum, m) => sum + parseFloat(String(m.assignedMonthlyCost || '0')),
    0
  );

  // Projected runway in months
  const runwayMonths =
    totalMonthlyLaborRate > 0 && remainingLabor > 0
      ? Math.round((remainingLabor / totalMonthlyLaborRate) * 10) / 10
      : null;

  // Filtered members
  const filteredMembers = project.members.filter((m) => {
    const q = memberSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (m.employeeName && m.employeeName.toLowerCase().includes(q)) ||
      (m.employeeNip && m.employeeNip.toLowerCase().includes(q)) ||
      m.roleInProject.toLowerCase().includes(q)
    );
  });

  // Filtered expenses
  const filteredExpenses = project.expenses.filter((exp) => {
    const matchesCat = expenseCategoryFilter === 'all' || exp.category === expenseCategoryFilter;
    const q = expenseSearch.toLowerCase().trim();
    const matchesSearch = !q || exp.expenseTitle.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

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

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'cloud_server':
        return <Server className="h-3.5 w-3.5 text-blue-600" />;
      case 'license':
        return <KeyRound className="h-3.5 w-3.5 text-purple-600" />;
      case 'travel':
        return <Plane className="h-3.5 w-3.5 text-amber-600" />;
      case 'equipment':
        return <Laptop className="h-3.5 w-3.5 text-emerald-600" />;
      default:
        return <Coins className="h-3.5 w-3.5 text-gray-600" />;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'cloud_server':
        return 'Server & Cloud';
      case 'license':
        return 'Lisensi Software';
      case 'travel':
        return 'Perjalanan Dinas';
      case 'equipment':
        return 'Perangkat Kerja';
      default:
        return 'Lainnya';
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/projects"
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors text-gray-600"
            title="Kembali ke Portofolio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded font-semibold border border-blue-200">
                {project.code}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(
                  project.status
                )}`}
              >
                {getStatusLabel(project.status)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>
                Klien: <strong className="text-gray-800">{project.clientName || 'Internal'}</strong>
              </span>
              <span>•</span>
              <span>
                Manajer: <strong className="text-gray-800">{project.managerEmail || 'Tanpa Manajer'}</strong>
              </span>
              <span>•</span>
              <span>
                Periode:{' '}
                <strong className="text-gray-800">
                  {new Date(project.startDate).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  {project.endDate
                    ? `- ${new Date(project.endDate).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : '(Fleksibel)'}
                </strong>
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {['super_admin', 'hr_admin'].includes(user?.role || '') && (
            <>
              <button
                onClick={openEditProject}
                className="btn btn-outline flex items-center gap-1.5 text-xs"
                title="Edit Pagu dan Informasi Proyek"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Pagu Proyek
              </button>

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
                className="btn btn-primary flex items-center gap-1.5 text-xs shadow-sm"
              >
                <Users className="h-3.5 w-3.5" />
                Tugaskan Tim
              </button>
            </>
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
            <Receipt className="h-3.5 w-3.5 text-amber-600" />
            Catat Biaya OPEX
          </button>
        </div>
      </div>

      {/* Workflow Step Guide Banner */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-blue-50/40 via-white to-gray-50/40 p-4 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-blue-700" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Alur Manajemen Anggaran Proyek (Project Costing)
            </h3>
          </div>
          <button
            onClick={() => setShowWorkflowGuide(!showWorkflowGuide)}
            className="text-gray-400 hover:text-gray-600 text-xs flex items-center gap-1"
          >
            <span>{showWorkflowGuide ? 'Sembunyikan' : 'Pelajari Alur'}</span>
            {showWorkflowGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {showWorkflowGuide && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
            <div className="p-2.5 rounded-lg bg-white border border-gray-200/80 shadow-xs">
              <div className="font-semibold text-gray-900 flex items-center gap-1.5 mb-1">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold inline-flex items-center justify-center">
                  1
                </span>
                Tetapkan Pagu
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Tentukan total pagu proyek yang dipecah menjadi <strong>Pagu SDM</strong> (tenaga kerja) dan <strong>Pagu OPEX</strong> (operasional langsung).
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-gray-200/80 shadow-xs">
              <div className="font-semibold text-gray-900 flex items-center gap-1.5 mb-1">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold inline-flex items-center justify-center">
                  2
                </span>
                Alokasikan Tim SDM
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Tugaskan karyawan dengan bobot alokasi (%). Beban gaji bulanan otomatis dihitung berdasarkan gaji pokok karyawan.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-gray-200/80 shadow-xs">
              <div className="font-semibold text-gray-900 flex items-center gap-1.5 mb-1">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold inline-flex items-center justify-center">
                  3
                </span>
                Catat Biaya OPEX
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Catat pengeluaran riil seperti server cloud, lisensi software, travel, dan perangkat kerja langsung ke pagu OPEX.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-gray-200/80 shadow-xs">
              <div className="font-semibold text-gray-900 flex items-center gap-1.5 mb-1">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold inline-flex items-center justify-center">
                  4
                </span>
                Akumulasi Otomatis
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Setiap payroll bulanan diproses, beban gaji anggota tim otomatis terakumulasi ke Realisasi SDM secara akurat.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dual-Track Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Project Budget */}
        <div className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <span>Total Pagu Proyek</span>
              <Wallet className="h-4 w-4 text-blue-700" />
            </div>
            <div className="text-xl font-bold text-gray-900 font-mono">
              {formatRupiah(totalBudgetNum)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Realisasi: <span className="font-mono font-semibold text-rose-600">{formatRupiah(project.totalSpent)}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-gray-500 font-medium">Sisa Kuota Total</span>
              <span className="font-mono font-bold text-emerald-700">{formatRupiah(remainingBudget)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${
                  project.usagePercentage >= 100
                    ? 'bg-rose-500'
                    : project.usagePercentage >= 85
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(100, project.usagePercentage)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: SDM (Labor) Track */}
        <div className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <span>Pagu Tenaga Kerja (Labor)</span>
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-xl font-bold text-indigo-700 font-mono">
              {formatRupiah(laborBudgetNum)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Realisasi: <span className="font-mono font-semibold text-rose-600">{formatRupiah(spentLaborNum)}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-gray-500 font-medium">Beban/Bulan Aktif</span>
              <span className="font-mono font-semibold text-gray-800">{formatRupiah(totalMonthlyLaborRate)}/bln</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${
                  laborUsagePct >= 100 ? 'bg-rose-500' : laborUsagePct >= 85 ? 'bg-amber-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.min(100, laborUsagePct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: OPEX Track */}
        <div className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <span>Pagu OPEX (Langsung)</span>
              <Receipt className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold text-amber-700 font-mono">
              {formatRupiah(opexBudgetNum)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Realisasi: <span className="font-mono font-semibold text-rose-600">{formatRupiah(spentOpexNum)}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-gray-500 font-medium">Sisa Kuota OPEX</span>
              <span className="font-mono font-bold text-emerald-700">{formatRupiah(remainingOpex)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${
                  opexUsagePct >= 100 ? 'bg-rose-500' : opexUsagePct >= 85 ? 'bg-amber-500' : 'bg-amber-600'
                }`}
                style={{ width: `${Math.min(100, opexUsagePct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Health & Runway Summary */}
        <div className="rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1.5">
              <span>Status Penyerapan</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                  project.usagePercentage >= 100
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : project.usagePercentage >= 85
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {project.usagePercentage}% Terpakai
              </span>
            </div>
            <div className="text-xl font-bold text-gray-900 font-mono">
              {project.usagePercentage >= 100
                ? 'Defisit Anggaran'
                : project.usagePercentage >= 85
                ? 'Mendekati Pagu'
                : 'Kondisi Aman'}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">
            {runwayMonths !== null ? (
              <span>
                Estimasi Runway SDM: <strong className="text-gray-800">~{runwayMonths} bulan</strong>
              </span>
            ) : (
              <span>Runway: Belum ada beban rutin</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabbed Management Area */}
      <div className="rounded-xl border border-gray-200/90 bg-white shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-gray-200 bg-gray-50/70 px-4 pt-2 gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-blue-700 text-blue-700 bg-white rounded-t-lg shadow-2xs font-bold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Alokasi SDM & Tim</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700">
              {project.members.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'expenses'
                ? 'border-blue-700 text-blue-700 bg-white rounded-t-lg shadow-2xs font-bold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Pengeluaran OPEX Langsung</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-700">
              {project.expenses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('breakdown')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'breakdown'
                ? 'border-blue-700 text-blue-700 bg-white rounded-t-lg shadow-2xs font-bold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Struktur & Analisis Biaya</span>
          </button>
        </div>

        {/* Tab 1: Members Content */}
        {activeTab === 'members' && (
          <div>
            {/* Filter and stats bar */}
            <div className="p-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500 font-medium">
                  Total Run-rate Tim:{' '}
                  <strong className="text-gray-900 font-mono">{formatRupiah(totalMonthlyLaborRate)}/bulan</strong>
                </span>
                <span>•</span>
                <span className="text-gray-500 font-medium">
                  Sisa Pagu SDM:{' '}
                  <strong className="text-emerald-700 font-mono">{formatRupiah(remainingLabor)}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari anggota tim..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-xs focus:border-blue-700 focus:outline-none"
                  />
                </div>

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
                    className="btn btn-primary text-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tugaskan Tim
                  </button>
                )}
              </div>
            </div>

            {/* Members table */}
            {filteredMembers.length === 0 ? (
              <div className="py-16 text-center px-4">
                <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900">
                  {memberSearch ? 'Anggota tim tidak ditemukan' : 'Belum ada anggota tim yang ditugaskan'}
                </h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                  {memberSearch
                    ? 'Coba sesuaikan kata kunci pencarian nama atau peran.'
                    : 'Tugaskan karyawan untuk mulai membebankan biaya gaji ke proyek ini.'}
                </p>
                {['super_admin', 'hr_admin'].includes(user?.role || '') && !memberSearch && (
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
                    className="btn btn-primary text-xs"
                  >
                    Tugaskan Anggota Pertama
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 uppercase font-semibold text-[11px] text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3">Karyawan</th>
                      <th className="px-5 py-3">Peran dalam Proyek</th>
                      <th className="px-5 py-3">Alokasi Waktu</th>
                      <th className="px-5 py-3">Beban Gaji / Bulan</th>
                      <th className="px-5 py-3">Masa Penugasan</th>
                      <th className="px-5 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-gray-900">{m.employeeName}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{m.employeeNip}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800 font-medium">
                            {m.roleInProject}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-800">{m.allocationPercentage}%</span>
                            <span className="text-[10px] text-gray-400">waktu kerja</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          <div className="font-semibold text-gray-900">
                            {formatRupiah(parseFloat(String(m.assignedMonthlyCost || '0')))}
                          </div>
                          <div className="text-[10px] text-gray-400">per bulan</div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                          {new Date(m.startDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          {m.endDate ? `- ${new Date(m.endDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}` : '(Aktif)'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {['super_admin', 'hr_admin'].includes(user?.role || '') && (
                            <button
                              onClick={() => handleRemoveMember(m.id, m.employeeName || undefined)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Hapus Penugasan"
                            >
                              <Trash2 className="h-4 w-4" />
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
        )}

        {/* Tab 2: Expenses Content */}
        {activeTab === 'expenses' && (
          <div>
            {/* Filter and stats bar */}
            <div className="p-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto text-xs font-medium pb-1 sm:pb-0">
                <button
                  onClick={() => setExpenseCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    expenseCategoryFilter === 'all'
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Semua ({project.expenses.length})
                </button>
                <button
                  onClick={() => setExpenseCategoryFilter('cloud_server')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    expenseCategoryFilter === 'cloud_server'
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Server/Cloud
                </button>
                <button
                  onClick={() => setExpenseCategoryFilter('license')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    expenseCategoryFilter === 'license'
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Lisensi
                </button>
                <button
                  onClick={() => setExpenseCategoryFilter('travel')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    expenseCategoryFilter === 'travel'
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Perjalanan
                </button>
                <button
                  onClick={() => setExpenseCategoryFilter('equipment')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    expenseCategoryFilter === 'equipment'
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Perangkat
                </button>
                <button
                  onClick={() => setExpenseCategoryFilter('other')}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    expenseCategoryFilter === 'other'
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Lainnya
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari transaksi OPEX..."
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-xs focus:border-blue-700 focus:outline-none"
                  />
                </div>

                <button
                  onClick={() => {
                    setExpenseTitle('');
                    setExpenseCategory('cloud_server');
                    setExpenseAmount('');
                    setExpenseDate(new Date().toISOString().split('T')[0]);
                    setExpenseError('');
                    setShowExpenseModal(true);
                  }}
                  className="btn btn-primary text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Catat Biaya OPEX
                </button>
              </div>
            </div>

            {/* Expenses table */}
            {filteredExpenses.length === 0 ? (
              <div className="py-16 text-center px-4">
                <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Receipt className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900">
                  {expenseSearch || expenseCategoryFilter !== 'all'
                    ? 'Pengeluaran OPEX tidak ditemukan'
                    : 'Belum ada pengeluaran operasional'}
                </h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                  {expenseSearch || expenseCategoryFilter !== 'all'
                    ? 'Coba sesuaikan kata kunci pencarian atau filter kategori.'
                    : 'Catat pengeluaran langsung seperti infrastruktur server, lisensi alat kerja, atau akomodasi.'}
                </p>
                {!expenseSearch && expenseCategoryFilter === 'all' && (
                  <button
                    onClick={() => {
                      setExpenseTitle('');
                      setExpenseCategory('cloud_server');
                      setExpenseAmount('');
                      setExpenseDate(new Date().toISOString().split('T')[0]);
                      setExpenseError('');
                      setShowExpenseModal(true);
                    }}
                    className="btn btn-primary text-xs"
                  >
                    Catat Pengeluaran Pertama
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 uppercase font-semibold text-[11px] text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3">Deskripsi Pengeluaran</th>
                      <th className="px-5 py-3">Kategori</th>
                      <th className="px-5 py-3">Nominal Biaya</th>
                      <th className="px-5 py-3">Tanggal Biaya</th>
                      <th className="px-5 py-3">Dicatat Oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-gray-900">{exp.expenseTitle}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {getCategoryIcon(exp.category)}
                            {getCategoryLabel(exp.category)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono font-semibold text-rose-600">
                          {formatRupiah(parseFloat(String(exp.amount || '0')))}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                          {new Date(exp.expenseDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {exp.submittedByEmail || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Breakdown & Structure Content */}
        {activeTab === 'breakdown' && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Tabel Komparasi Struktur Biaya (SDM vs OPEX)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Perbandingan alokasi rencana awal dengan realisasi pengeluaran berjalan per komponen biaya.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 uppercase font-semibold text-[11px] text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3">Komponen Biaya</th>
                    <th className="px-5 py-3">Pagu Direncanakan</th>
                    <th className="px-5 py-3">Realisasi Berjalan</th>
                    <th className="px-5 py-3">Sisa Anggaran Bebas</th>
                    <th className="px-5 py-3">Penyerapan (%)</th>
                    <th className="px-5 py-3">Status Risiko</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {/* Labor Row */}
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-sans font-semibold text-gray-900 flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-600 shrink-0" />
                      <div>
                        <span>Biaya SDM (Labor Costing)</span>
                        <div className="text-[10px] text-gray-400 font-normal">
                          {project.members.length} anggota tim aktif
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">
                      {formatRupiah(laborBudgetNum)}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-rose-600">
                      {formatRupiah(spentLaborNum)}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-emerald-700">
                      {formatRupiah(remainingLabor)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span>{laborUsagePct}%</span>
                        <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              laborUsagePct >= 100
                                ? 'bg-rose-500'
                                : laborUsagePct >= 85
                                ? 'bg-amber-500'
                                : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(100, laborUsagePct)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-sans">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                          laborUsagePct >= 100
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : laborUsagePct >= 85
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {laborUsagePct >= 100 ? 'Overbudget' : laborUsagePct >= 85 ? 'Peringatan' : 'Aman'}
                      </span>
                    </td>
                  </tr>

                  {/* OPEX Row */}
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-sans font-semibold text-gray-900 flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-amber-600 shrink-0" />
                      <div>
                        <span>Biaya Operasional Langsung (OPEX)</span>
                        <div className="text-[10px] text-gray-400 font-normal">
                          {project.expenses.length} transaksi tercatat
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">
                      {formatRupiah(opexBudgetNum)}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-rose-600">
                      {formatRupiah(spentOpexNum)}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-emerald-700">
                      {formatRupiah(remainingOpex)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span>{opexUsagePct}%</span>
                        <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              opexUsagePct >= 100
                                ? 'bg-rose-500'
                                : opexUsagePct >= 85
                                ? 'bg-amber-500'
                                : 'bg-amber-600'
                            }`}
                            style={{ width: `${Math.min(100, opexUsagePct)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-sans">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                          opexUsagePct >= 100
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : opexUsagePct >= 85
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {opexUsagePct >= 100 ? 'Overbudget' : opexUsagePct >= 85 ? 'Peringatan' : 'Aman'}
                      </span>
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr className="bg-gray-50/80 font-bold text-gray-900">
                    <td className="px-5 py-3.5 font-sans">TOTAL KESELURUHAN</td>
                    <td className="px-5 py-3.5">{formatRupiah(totalBudgetNum)}</td>
                    <td className="px-5 py-3.5 text-rose-600">{formatRupiah(project.totalSpent)}</td>
                    <td className="px-5 py-3.5 text-emerald-700">{formatRupiah(remainingBudget)}</td>
                    <td className="px-5 py-3.5">{project.usagePercentage}%</td>
                    <td className="px-5 py-3.5 font-sans">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                          project.usagePercentage >= 100
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : project.usagePercentage >= 85
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {project.usagePercentage >= 100
                          ? 'Defisit'
                          : project.usagePercentage >= 85
                          ? 'Peringatan'
                          : 'Sehat'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Costing Insights */}
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs space-y-2">
              <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-blue-700" />
                Catatan Finansial & Proyeksi Runway
              </div>
              <ul className="list-disc list-inside text-blue-800/80 space-y-1 pl-1">
                <li>
                  Beban rutin tim saat ini: <strong>{formatRupiah(totalMonthlyLaborRate)} / bulan</strong>.
                </li>
                {runwayMonths !== null && (
                  <li>
                    Dengan sisa pagu SDM sebesar <strong>{formatRupiah(remainingLabor)}</strong>, proyek memiliki estimasi ketahanan biaya SDM selama <strong>~{runwayMonths} bulan ke depan</strong>.
                  </li>
                )}
                <li>
                  Realisasi tenaga kerja secara resmi tercatat ke buku besar keuangan perusahaan pada saat pemrosesan gaji (payroll) bulanan ditutup.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Modal Edit Project */}
      {showEditProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="rounded-xl border border-gray-200 bg-white w-full max-w-lg p-6 shadow-xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-700" />
                Edit Pagu & Informasi Proyek
              </h3>
              <button
                onClick={() => setShowEditProjectModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveProjectEdit} className="space-y-4">
              {projectEditError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{projectEditError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Kode Proyek *
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono focus:border-blue-700 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Status Proyek
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none bg-white"
                  >
                    <option value="planning">Perencanaan</option>
                    <option value="active">Sedang Berjalan</option>
                    <option value="on_hold">Ditunda</option>
                    <option value="completed">Selesai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nama Proyek *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Klien / Sponsor
                  </label>
                  <input
                    type="text"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Project Manager
                  </label>
                  <select
                    value={editManagerUserId}
                    onChange={(e) => setEditManagerUserId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none bg-white"
                  >
                    <option value="">Pilih Manajer Proyek</option>
                    {managerUsers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.email} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Budget Allocation */}
              <div className="p-3.5 bg-gray-50/80 rounded-lg border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-blue-700" />
                    Penetapan Pagu Anggaran
                  </span>
                  {editTotalBudget && (
                    <span className="text-[11px] font-mono font-semibold text-blue-700">
                      {formatRupiah(parseFloat(editTotalBudget) || 0)}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Total Pagu Anggaran Proyek (IDR) *
                  </label>
                  <input
                    type="number"
                    min="1000000"
                    step="1000000"
                    value={editTotalBudget}
                    onChange={(e) => setEditTotalBudget(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono focus:border-blue-700 focus:outline-none bg-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Pagu SDM (Labor)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="500000"
                      value={editLaborBudget}
                      onChange={(e) => setEditLaborBudget(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono focus:border-blue-700 focus:outline-none bg-white"
                    />
                    {editLaborBudget && (
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {formatRupiah(parseFloat(editLaborBudget) || 0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Pagu OPEX (Operasional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="500000"
                      value={editOperationalBudget}
                      onChange={(e) => setEditOperationalBudget(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono focus:border-blue-700 focus:outline-none bg-white"
                    />
                    {editOperationalBudget && (
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {formatRupiah(parseFloat(editOperationalBudget) || 0)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tanggal Mulai *
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Target Selesai
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
                  className="btn btn-outline text-xs"
                  disabled={submittingProjectEdit}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingProjectEdit || !editName.trim()}
                  className="btn btn-primary flex items-center gap-1.5 text-xs"
                >
                  {submittingProjectEdit ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Member */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="rounded-xl border border-gray-200 bg-white w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-700" />
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
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{memberError}</span>
                </div>
              )}

              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Pilih Karyawan *
                </label>
                <select
                  value={memberEmployeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none bg-white"
                  required
                >
                  <option value="">Pilih Karyawan</option>
                  {employeesList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.nip}) - Gaji {formatRupiah(Number(emp.baseSalary || 0))}
                    </option>
                  ))}
                </select>
                {selectedEmployee && (
                  <div className="mt-1 text-[11px] text-gray-500">
                    Gaji Pokok: <strong className="text-gray-800 font-mono">{formatRupiah(selectedEmployee.baseSalary)}</strong> / bulan
                  </div>
                )}
              </div>

              {/* Role in Project */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Peran dalam Proyek *
                </label>
                <input
                  type="text"
                  placeholder="Misal: Lead Developer, UI/UX Designer, QA"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none"
                  required
                />
              </div>

              {/* Allocation & Calculation Box */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">
                    Bobot Alokasi Waktu (%)
                  </label>
                  <span className="text-xs font-bold text-blue-700">{memberAllocation}%</span>
                </div>

                {/* Preset Allocation Buttons */}
                <div className="flex items-center gap-1.5">
                  {['25', '50', '75', '100'].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleAllocationChange(pct)}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors ${
                        memberAllocation === pct
                          ? 'bg-blue-700 text-white shadow-2xs'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">
                    Beban Gaji Proyek / Bulan (IDR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={memberMonthlyCost}
                    onChange={(e) => setMemberMonthlyCost(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none font-mono bg-white"
                    required
                  />
                  {memberMonthlyCost && (
                    <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                      {formatRupiah(parseFloat(memberMonthlyCost) || 0)} / bulan
                    </div>
                  )}
                </div>

                {selectedEmployee && (
                  <div className="text-[10px] text-gray-500 bg-white p-2 rounded border border-gray-150">
                    Formula: {formatRupiah(selectedEmployee.baseSalary)} × {memberAllocation}% ={' '}
                    <strong className="text-gray-900 font-mono">
                      {formatRupiah(parseFloat(memberMonthlyCost) || 0)}/bln
                    </strong>
                  </div>
                )}
              </div>

              {/* Assignment Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mulai Penugasan *
                  </label>
                  <input
                    type="date"
                    value={memberStartDate}
                    onChange={(e) => setMemberStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Selesai Penugasan
                  </label>
                  <input
                    type="date"
                    value={memberEndDate}
                    onChange={(e) => setMemberEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="btn btn-outline text-xs"
                  disabled={submittingMember}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingMember || !memberEmployeeId || !memberRole.trim()}
                  className="btn btn-primary flex items-center gap-1.5 text-xs"
                >
                  {submittingMember ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
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
          <div className="rounded-xl border border-gray-200 bg-white w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-amber-600" />
                Catat Pengeluaran Operasional (OPEX)
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
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{expenseError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Deskripsi / Judul Pengeluaran *
                </label>
                <input
                  type="text"
                  placeholder="Misal: AWS Cloud Hosting Periode Q1"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Kategori Biaya *
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none bg-white"
                  >
                    <option value="cloud_server">Server & Cloud</option>
                    <option value="license">Lisensi Software</option>
                    <option value="travel">Perjalanan Dinas</option>
                    <option value="equipment">Perangkat Kerja</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tanggal Biaya *
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nominal Biaya (IDR) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="50000"
                  placeholder="2500000"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-blue-700 focus:outline-none font-mono"
                  required
                />
                {expenseAmount && (
                  <div className="text-[11px] font-mono text-amber-700 mt-1">
                    {formatRupiah(parseFloat(expenseAmount) || 0)}
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded bg-gray-50 border border-gray-200 text-[11px] text-gray-600 flex items-center justify-between">
                <span>Sisa Kuota OPEX Saat Ini:</span>
                <strong className="font-mono text-emerald-700">{formatRupiah(remainingOpex)}</strong>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="btn btn-outline text-xs"
                  disabled={submittingExpense}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense || !expenseTitle.trim() || !expenseAmount}
                  className="btn btn-primary flex items-center gap-1.5 text-xs"
                >
                  {submittingExpense ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
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
