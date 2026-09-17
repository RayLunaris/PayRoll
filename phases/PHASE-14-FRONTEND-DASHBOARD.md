# Phase 14: Frontend Dashboard

**Objective:** Implementasi halaman dashboard dengan statistik dan charts  
**Estimated Time:** 6-8 hours  
**Prerequisites:** Phase 13 selesai

---

## Tasks

### 14.1 Create Dashboard Page

```bash
# src/app/(dashboard)/page.tsx
cat > src/app/(dashboard)/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import StatCard from '@/components/dashboard/StatCard';
import AttendanceChart from '@/components/dashboard/AttendanceChart';
import PayrollChart from '@/components/dashboard/PayrollChart';
import RecentActivity from '@/components/dashboard/RecentActivity';
import QuickActions from '@/components/dashboard/QuickActions';
import api from '@/lib/api';
import {
  Users,
  CalendarCheck,
  Clock,
  Wallet,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    pendingApprovals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [employees, attendance, leaves, approvals] = await Promise.all([
        api.get('/api/employees').catch(() => ({ data: { data: [] } })),
        api.get('/api/attendance/today').catch(() => ({ data: { data: null } })),
        api.get('/api/leaves/approvals').catch(() => ({ data: { data: [] } })),
      ]);

      setStats({
        totalEmployees: employees?.data?.data?.length || 0,
        presentToday: attendance?.data?.data?.checkIn ? 1 : 0,
        // TODO: Fetch actual counts
        onLeave: 0,
        pendingApprovals: approvals?.data?.data?.length || 0,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Ringkasan aktivitas dan statistik perusahaan hari ini
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Karyawan"
          value={stats.totalEmployees}
          icon={<Users className="h-6 w-6" />}
          color="blue"
        />
        <StatCard
          title="Hadir Hari Ini"
          value={stats.presentToday}
          icon={<CalendarCheck className="h-6 w-6" />}
          color="green"
        />
        <StatCard
          title="Cuti Berjalan"
          value={stats.onLeave}
          icon={<Clock className="h-6 w-6" />}
          color="yellow"
        />
        <StatCard
          title="Menunggu Persetujuan"
          value={stats.pendingApprovals}
          icon={<AlertCircle className="h-6 w-6" />}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 card">
          <AttendanceChart />
        </div>
        <div className="card">
          <PayrollChart />
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <RecentActivity />
        </div>
        <div className="card">
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
EOF
```

### 14.2 Create Stat Card Component

```bash
# src/components/dashboard/StatCard.tsx
cat > src/components/dashboard/StatCard.tsx << 'EOF'
'use client';

const colorStyles = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
  },
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: keyof typeof colorStyles;
  subtitle?: string;
}

export default function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const style = colorStyles[color];

  return (
    <div className="bg-white rounded-xl shadow-card p-6 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className={`mt-1 text-sm ${style.text}`}>{subtitle}</p>
          )}
        </div>
        <div className={`${style.bg} ${style.text} p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
EOF
```

### 14.3 Create Attendance Chart Component

```bash
# src/components/dashboard/AttendanceChart.tsx
cat > src/components/dashboard/AttendanceChart.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import api from '@/lib/api';

export default function AttendanceChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // TODO: Fetch attendance statistics for the last 7 days
      // Add sample data for now
      setData([
        { date: 'Sen', present: 45, absent: 3, late: 2 },
        { date: 'Sel', present: 47, absent: 1, late: 4 },
        { date: 'Rab', present: 46, absent: 2, late: 3 },
        { date: 'Kam', present: 48, absent: 1, late: 1 },
        { date: 'Jum', present: 44, absent: 4, late: 2 },
        { date: 'Sab', present: 25, absent: 10, late: 5 },
        { date: 'Min', present: 10, absent: 5, late: 1 },
      ]);
    } catch (error) {
      console.error('Failed to fetch attendance chart:', error);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Statistik Kehadiran Mingguan
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="present"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              name="Hadir"
            />
            <Area
              type="monotone"
              dataKey="late"
              stackId="1"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.3}
              name="Terlambat"
            />
            <Area
              type="monotone"
              dataKey="absent"
              stackId="1"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.3}
              name="Absen"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
EOF
```

### 14.4 Create Payroll Chart Component

```bash
# src/components/dashboard/PayrollChart.tsx
cat > src/components/dashboard/PayrollChart.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function PayrollChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // TODO: Fetch payroll breakdown data
      setData([
        { name: 'Gaji Pokok', value: 500000000 },
        { name: 'Lembur', value: 30000000 },
        { name: 'Tunjangan', value: 40000000 },
        { name: 'BPJS', value: 60000000 },
        { name: 'Pajak', value: 80000000 },
      ]);
    } catch (error) {
      console.error('Failed to fetch payroll chart:', error);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Komposisi Payroll
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
EOF
```

### 14.5 Create Recent Activity Component

```bash
# src/components/dashboard/RecentActivity.tsx
cat > src/components/dashboard/RecentActivity.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  MessageCircle,
  Wallet,
  Building2,
} from 'lucide-react';
import api from '@/lib/api';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  icon: React.ReactNode;
  color: string;
}

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      // TODO: Fetch recent activities from all services
      setActivities([
        {
          id: '1',
          type: 'attendance',
          title: 'Presensi masuk',
          description: 'Karyawan check-in di Kantor Pusat',
          createdAt: new Date().toISOString(),
          icon: <CalendarCheck className="h-4 w-4" />,
          color: 'green',
        },
        {
          id: '2',
          type: 'leave',
          title: 'Cuti disetujui',
          description: 'Cuti tahunan untuk 3 karyawan',
          createdAt: new Date().toISOString(),
          icon: <CalendarDays className="h-4 w-4" />,
          color: 'blue',
        },
        {
          id: '3',
          type: 'payroll',
          title: 'Payroll diproses',
          description: 'Payroll bulan sebelumnya selesai diproses',
          createdAt: new Date().toISOString(),
          icon: <Wallet className="h-4 w-4" />,
          color: 'yellow',
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Aktivitas Terbaru
      </h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className={`
              p-2 rounded-lg
              ${activity.color === 'green' ? 'bg-emerald-50 text-emerald-600' : ''}
              ${activity.color === 'blue' ? 'bg-blue-50 text-blue-600' : ''}
              ${activity.color === 'yellow' ? 'bg-yellow-50 text-yellow-600' : ''}
            `}>
              {activity.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{activity.title}</p>
              <p className="text-sm text-gray-500">{activity.description}</p>
              <p className="text-xs text-gray-400">
                {new Date(activity.createdAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
EOF
```

### 14.6 Create Quick Actions Component

```bash
# src/components/dashboard/QuickActions.tsx
cat > src/components/dashboard/QuickActions.tsx << 'EOF'
'use client';

import Link from 'next/link';
import {
  CalendarCheck,
  CalendarDays,
  Wallet,
  Users,
  MessageCircle,
  FileText,
  Clock,
  Megaphone,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

const actions = [
  { label: 'Check-in', href: '/attendance/check-in', icon: <CalendarCheck className="h-5 w-5" />, roles: ['*'] },
  { label: 'Ajukan Cuti', href: '/leave/request', icon: <CalendarDays className="h-5 w-5" />, roles: ['*'] },
  { label: 'Slip Gaji', href: '/payroll/slips', icon: <FileText className="h-5 w-5" />, roles: ['*'] },
  { label: 'Kasbon', href: '/payroll/cash-advances', icon: <Wallet className="h-5 w-5" />, roles: ['*'] },
  { label: 'Karyawan', href: '/employees', icon: <Users className="h-5 w-5" />, roles: ['hr_admin', 'super_admin'] },
  { label: 'Pengumuman', href: '/social/announcements', icon: <Megaphone className="h-5 w-5" />, roles: ['hr_admin', 'super_admin'] },
  { label: 'Lembur', href: '/overtime', icon: <Clock className="h-5 w-5" />, roles: ['*'] },
  { label: 'Sosial', href: '/social/feed', icon: <MessageCircle className="h-5 w-5" />, roles: ['*'] },
];

export default function QuickActions() {
  const user = useAuthStore((state) => state.user);

  const visibleActions = actions.filter((action) => 
    action.roles.includes('*') || (user && action.roles.includes(user.role))
  );

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Aksi Cepat
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {visibleActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <div className="text-gray-600">{action.icon}</div>
            <span className="text-xs font-medium text-gray-700 text-center">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
EOF
```

---

## Verification Checklist

- [ ] Dashboard page berfungsi
- [ ] Stat cards menampilkan data
- [ ] Attendance chart berfungsi
- [ ] Payroll chart berfungsi
- [ ] Recent activity berfungsi
- [ ] Quick actions berfungsi
- [ ] Data dimuat dari API
- [ ] Loading state ditampilkan
- [ ] Error handling bekerja

---

## Next Phase

Setelah Phase 14 selesai, lanjut ke:
**[Phase 15: Frontend Attendance](./PHASE-15-FRONTEND-ATTENDANCE.md)**