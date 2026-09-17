# Phase 21: Frontend Reports

**Objective:** Implementasi halaman laporan (attendance, leave, payroll summary) dengan export
**Estimated Time:** 8-10 hours  
**Prerequisites:** Phase 20 selesai

---

## Tasks

### 21.1 Create Reports Dashboard Page

```bash
# src/app/(dashboard)/reports/page.tsx
cat > src/app/(dashboard)/reports/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  BarChart3, FileText, Clock, UserCheck, CalendarDays, CreditCard,
  Download, TrendingUp, Users
} from 'lucide-react';

export default function ReportsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !['hr_admin', 'super_admin', 'manager'].includes(user.role)) {
      router.push('/dashboard');
    }
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/reports/dashboard');
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    { label: 'Total Karyawan', value: stats?.totalEmployees || 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Hadir Hari Ini', value: stats?.presentToday || 0, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Sedang Cuti', value: stats?.onLeaveToday || 0, icon: CalendarDays, color: 'text-purple-600 bg-purple-50' },
    { label: 'Lembur Bulan Ini', value: `${stats?.totalOvertimeHours || 0} jam`, icon: Clock, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          Laporan &amp; Statistik
        </h1>
        <p className="text-gray-500 mt-1">Pantau kinerja dan aktivitas perusahaan</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className={`inline-flex p-3 rounded-lg mb-3 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Report type cards */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Jenis Laporan</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <ReportCard
          title="Laporan Kehadiran"
          description="Rekap kehadiran, keterlambatan, dan lembur per karyawan"
          icon={Clock}
          href="/reports/attendance"
        />
        <ReportCard
          title="Laporan Cuti"
          description="Rekap pengajuan dan sisa cuti karyawan"
          icon={CalendarDays}
          href="/reports/leave"
        />
        <ReportCard
          title="Laporan Penggajian"
          description="Rekap gaji, potongan, dan total biaya payroll"
          icon={CreditCard}
          href="/reports/payroll"
        />
        <ReportCard
          title="Laporan Lembur"
          description="Rekap jam lembur dan biaya lembur per periode"
          icon={TrendingUp}
          href="/reports/overtime"
        />
        <ReportCard
          title="Statistik Karyawan"
          description="Distribusi karyawan berdasarkan departemen"
          icon={Users}
          href="/reports/employee"
        />
        <ReportCard
          title="Export Semua Laporan"
          description="Download laporan dalam format PDF/Excel"
          icon={Download}
          href="/reports/export"
        />
      </div>
    </div>
  );
}

function ReportCard({ title, description, icon: Icon, href }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="card text-left hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
    >
      <div className="p-2.5 bg-blue-50 rounded-lg mb-3 inline-flex">
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
      <div className="mt-3 text-sm text-blue-600 font-medium flex items-center gap-1">
        <FileText className="h-4 w-4" />
        Buka Laporan
      </div>
    </button>
  );
}
EOF
```

### 21.2 Create Attendance Report Page

```bash
# src/app/(dashboard)/reports/attendance/page.tsx
cat > src/app/(dashboard)/reports/attendance/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { Download, Filter, Loader2 } from 'lucide-react';

export default function AttendanceReportPage() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    department: '',
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/reports/attendance', { params: filters });
      setReport(response.data.data);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filters.month, filters.year]);

  const handleExport = async (format: string) => {
    try {
      const response = await api.get(`/api/reports/attendance/export`, {
        params: { ...filters, format },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-kehadiran-${filters.year}-${filters.month}.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Laporan', href: '/reports' }, { label: 'Kehadiran' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Kehadiran</h1>
          <p className="text-gray-500 mt-1">Rekap kehadiran dan keterlambatan karyawan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('pdf')} className="btn btn-danger">
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button onClick={() => handleExport('excel')} className="btn btn-success">
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filter</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Bulan</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: Number(e.target.value) })}
              className="input"
            >
              {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
                .map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Tahun</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}
              className="input"
            >
              {[2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Departemen</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="input"
            >
              <option value="">Semua</option>
              <option value="engineering">Engineering</option>
              <option value="hr">HR</option>
              <option value="finance">Finance</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>NIP</th>
              <th>Nama</th>
              <th>Departemen</th>
              <th>Total Hadir</th>
              <th>Total Izin</th>
              <th>Telat (&gt;5m)</th>
              <th>Hadir Tepat</th>
              <th>% Kehadiran</th>
            </tr>
          </thead>
          <tbody>
            {report.map((row) => (
              <tr key={row.employeeId}>
                <td className="font-mono text-xs">{row.nip}</td>
                <td className="font-medium">{row.fullName}</td>
                <td>{row.department}</td>
                <td className="text-center">{row.totalPresent}</td>
                <td className="text-center">{row.totalPermission}</td>
                <td className="text-center text-red-600">{row.totalLate}</td>
                <td className="text-center">{row.totalOnTime}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          row.attendanceRate >= 80 ? 'bg-emerald-500' :
                          row.attendanceRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${row.attendanceRate}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{row.attendanceRate}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {report.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  Tidak ada data untuk periode ini
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="flex justify-center pt-8">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
EOF
```

### 21.3 Create Payroll Report Page

```bash
# src/app/(dashboard)/reports/payroll/page.tsx
cat > src/app/(dashboard)/reports/payroll/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { Download, Filter, Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

export default function PayrollReportPage() {
  const [summary, setSummary] = useState(null);
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    status: '',
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/reports/payroll', { params: filters });
      setReport(response.data.data.employees);
      setSummary(response.data.data.summary);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filters.month, filters.year]);

  const handleExport = async (format: string) => {
    try {
      const response = await api.get(`/api/reports/payroll/export`, {
        params: { ...filters, format },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-payroll-${filters.year}-${filters.month}.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  const summaryCards = [
    { label: 'Total Penggajian', value: summary ? `Rp ${formatNumber(summary.totalPayroll)}` : '-', icon: Wallet, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Potongan', value: summary ? `Rp ${formatNumber(summary.totalDeductions)}` : '-', icon: TrendingDown, color: 'text-red-600 bg-red-50' },
    { label: 'Total Lembur', value: summary ? `Rp ${formatNumber(summary.totalOvertime)}` : '-', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
  ];

  function formatNumber(num) {
    return num.toLocaleString('id-ID');
  }

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Laporan', href: '/reports' }, { label: 'Penggajian' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Penggajian</h1>
          <p className="text-gray-500 mt-1">Rekap gaji dan potongan per periode</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('pdf')} className="btn btn-danger">
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button onClick={() => handleExport('excel')} className="btn btn-success">
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        {summaryCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className={`inline-flex p-3 rounded-lg mb-3 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filter</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Bulan</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: Number(e.target.value) })}
              className="input"
            >
              {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
                .map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Tahun</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}
              className="input"
            >
              {[2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status Payroll</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input"
            >
              <option value="">Semua</option>
              <option value="pending">Pending</option>
              <option value="paid">Dibayar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>NIP</th>
              <th>Nama</th>
              <th>Gaji Pokok</th>
              <th>Lembur</th>
              <th>Potongan</th>
              <th>Total Diterima</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {report.map((row) => (
              <tr key={row.employeeId}>
                <td className="font-mono text-xs">{row.nip}</td>
                <td className="font-medium">{row.fullName}</td>
                <td>Rp {formatNumber(row.baseSalary)}</td>
                <td className="text-emerald-600">Rp {formatNumber(row.overtimePay)}</td>
                <td className="text-red-600">Rp {formatNumber(row.totalDeductions)}</td>
                <td className="font-semibold">Rp {formatNumber(row.netSalary)}</td>
                <td>
                  <span className={`badge ${row.status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>
                    {row.status === 'paid' ? 'Dibayar' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
            {report.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  Belum ada payroll untuk periode ini
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="flex justify-center pt-8">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
EOF
```

### 21.4 Create Overtime & Employee Statistic Report Pages

```bash
# src/app/(dashboard)/reports/overtime/page.tsx
cat > src/app/(dashboard)/reports/overtime/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { Download, Loader2 } from 'lucide-react';

export default function OvertimeReportPage() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/reports/overtime', { params: filters });
      setReport(response.data.data);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filters.month, filters.year]);

  const handleExport = async () => {
    try {
      const response = await api.get(`/api/reports/overtime/export`, {
        params: { ...filters, format: 'excel' },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-lembur-${filters.year}-${filters.month}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Laporan', href: '/reports' }, { label: 'Lembur' }]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Lembur</h1>
          <p className="text-gray-500 mt-1">Rekap jam dan biaya lembur karyawan</p>
        </div>
        <button onClick={handleExport} className="btn btn-success">
          <Download className="h-4 w-4" />
          Export Excel
        </button>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="label">Bulan</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: Number(e.target.value) })}
              className="input"
            >
              {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
                .map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Tahun</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}
              className="input"
            >
              {[2025, 2026].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>NIP</th>
              <th>Nama</th>
              <th>Total Jam Lembur</th>
              <th>Tarif per Jam</th>
              <th>Total Biaya</th>
            </tr>
          </thead>
          <tbody>
            {report.map((row) => (
              <tr key={row.employeeId}>
                <td className="font-mono text-xs">{row.nip}</td>
                <td className="font-medium">{row.fullName}</td>
                <td className="text-center">{row.totalHours} jam</td>
                <td className="text-center">Rp {row.hourlyRate?.toLocaleString('id-ID')}</td>
                <td className="font-semibold">Rp {row.totalCost?.toLocaleString('id-ID')}</td>
              </tr>
            ))}
            {report.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">
                  Tidak ada data lembur untuk periode ini
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="flex justify-center pt-8">
          <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
EOF
```

```bash
# src/app/(dashboard)/reports/employee/page.tsx
cat > src/app/(dashboard)/reports/employee/page.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import api from '@/lib/api';
import { Users } from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

export default function EmployeeStatisticPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await api.get('/api/reports/employee');
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const departmentData = data?.byDepartment?.map((d) => ({
    name: d.department,
    value: d.count,
  })) || [];

  const genderData = data?.byGender?.map((g) => ({
    name: g.gender === 'male' ? 'Pria' : 'Wanita',
    value: g.count,
  })) || [];

  const statusData = data?.byStatus?.map((s) => ({
    name: s.status === 'active' ? 'Aktif' : 'Non-Aktif',
    value: s.count,
  })) || [];

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Laporan', href: '/reports' }, { label: 'Statistik Karyawan' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />
          Statistik Karyawan
        </h1>
        <p className="text-gray-500 mt-1">Distribusi karyawan perusahaan</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Per Departemen</h3>
          {departmentData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name} (${entry.value})`}
                  >
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-10">Belum ada data</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Per Gender</h3>
          {genderData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={genderData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Jumlah" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-10">Belum ada data</p>
          )}
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Per Status Kepegawaian</h3>
          {statusData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry) => `${entry.name} (${entry.value})`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-10">Belum ada data</p>
          )}
        </div>
      </div>
    </div>
  );
}
EOF
```

---

## Verification Checklist

- [ ] Dashboard laporan menampilkan statistik
- [ ] Laporan kehadiran per periode (filter bulan/tahun/departemen)
- [ ] Laporan payroll per periode
- [ ] Laporan lembur per periode
- [ ] Statistik karyawan dengan chart (Pie & Bar)
- [ ] Export PDF/Excel bekerja (download berhasil)
- [ ] Role access dibatasi (HR, Manager, Super Admin)
- [ ] Mobile responsive

---

## Next Phase

Setelah Phase 21 selesai, lanjut ke:
**[Phase 22: Frontend Settings](./PHASE-22-FRONTEND-SETTINGS.md)**