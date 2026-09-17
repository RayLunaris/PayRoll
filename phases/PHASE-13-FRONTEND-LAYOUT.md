# Phase 13: Frontend Layout

**Objective:** Implementasi sidebar, header, dan layout responsif  
**Estimated Time:** 8-10 hours  
**Prerequisites:** Phase 12 selesai

---

## Tasks

### 13.1 Create Sidebar Component

```bash
# src/components/layout/Sidebar.tsx
cat > src/components/layout/Sidebar.tsx << 'EOF'
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Wallet,
  Users,
  MessageCircle,
  Clock,
  BarChart3,
  Settings,
  FileText,
  Megaphone,
  ChevronLeft,
  Copyright,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useState } from 'react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  roles?: string[];
  children?: { label: string; href: string; roles?: string[] }[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [collapsed, setCollapsed] = useState(false);

  const isVisible = (roles?: string[]) => {
    if (!roles) return true;
    if (!user) return false;
    return roles.includes(user.role);
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: '/dashboard',
    },
    {
      label: 'Kehadiran',
      icon: <CalendarCheck className="h-5 w-5" />,
      href: '/attendance',
      children: [
        { label: 'Check-in / Check-out', href: '/attendance/check-in' },
        { label: 'Riwayat Kehadiran', href: '/attendance/history' },
        { label: 'Laporan Kehadiran', href: '/attendance/report', roles: ['hr_admin', 'manager', 'super_admin'] },
      ],
    },
    {
      label: 'Cuti',
      icon: <CalendarDays className="h-5 w-5" />,
      href: '/leave',
      children: [
        { label: 'Pengajuan Cuti', href: '/leave/request' },
        { label: 'Riwayat Cuti', href: '/leave/history' },
        { label: 'Kuota Cuti', href: '/leave/quota' },
        { label: 'Persetujuan Cuti', href: '/leave/approvals', roles: ['hr_admin', 'manager', 'super_admin'] },
      ],
    },
    {
      label: 'Lembur',
      icon: <Clock className="h-5 w-5" />,
      href: '/overtime',
    },
    {
      label: 'Payroll',
      icon: <Wallet className="h-5 w-5" />,
      href: '/payroll',
      children: [
        { label: 'Slip Gaji', href: '/payroll/slips' },
        { label: 'Kasbon', href: '/payroll/cash-advances' },
        { label: 'Proses Payroll', href: '/payroll/process', roles: ['hr_admin', 'super_admin'] },
        { label: 'Laporan BPJS', href: '/payroll/bpjs', roles: ['hr_admin', 'super_admin'] },
        { label: 'Laporan Pajak', href: '/payroll/tax', roles: ['hr_admin', 'super_admin'] },
      ],
    },
    {
      label: 'Karyawan',
      icon: <Users className="h-5 w-5" />,
      href: '/employees',
      roles: ['hr_admin', 'super_admin'],
    },
    {
      label: 'Shift',
      icon: <Copyright className="h-5 w-5" />,
      href: '/shift',
    },
    {
      label: 'Sosial',
      icon: <MessageCircle className="h-5 w-5" />,
      href: '/social',
      children: [
        { label: 'Feed', href: '/social/feed' },
        { label: 'Pesan', href: '/social/messages' },
        { label: 'Forum', href: '/social/forum' },
        { label: 'Pengumuman', href: '/social/announcements' },
      ],
    },
    {
      label: 'Laporan',
      icon: <BarChart3 className="h-5 w-5" />,
      href: '/reports',
      roles: ['hr_admin', 'manager', 'super_admin'],
    },
    {
      label: 'Pengaturan',
      icon: <Settings className="h-5 w-5" />,
      href: '/settings',
      roles: ['super_admin'],
    },
  ];

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 h-screen bg-slate-900 text-white transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-500">P</span>
            <span className="font-semibold">PayrollPro</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
        {menuItems.map((item) => {
          if (!isVisible(item.roles)) return null;

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                  ${pathname.startsWith(item.href) 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-slate-800 hover:text-white'}
                `}
              >
                {item.icon}
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>

              {item.children && !collapsed && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children.map((child) => {
                    if (!isVisible(child.roles)) return null;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`
                          block px-3 py-1.5 rounded-lg text-sm transition-colors
                          ${pathname === child.href
                            ? 'bg-blue-600/50 text-white'
                            : 'text-gray-400 hover:bg-slate-800 hover:text-white'}
                        `}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
EOF
```

### 13.2 Create Header Component

```bash
# src/components/layout/Header.tsx
cat > src/components/layout/Header.tsx << 'EOF'
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Search,
  UserCircle,
  LogOut,
  MessageCircle,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useState, useRef, useEffect } from 'react';

export default function Header() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    hr_admin: 'HR Admin',
    manager: 'Manager',
    employee: 'Karyawan',
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari..."
              className="input pl-10"
            />
          </div>
        </div>

        {/* Right side items */}
        <div className="flex items-center gap-4">
          {/* Quick actions */}
          <Link
            href="/attendance/check-in"
            className="btn btn-primary !py-1.5 hidden md:inline-flex"
          >
            Check-in
          </Link>

          {/* Messages */}
          <Link
            href="/social/messages"
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          </Link>

          {/* Notifications */}
          <Link
            href="/notifications"
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          </Link>

          {/* User menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-white" />
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-gray-900">
                  {user?.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs text-gray-500">
                  {user ? roleLabels[user.role] : ''}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Profil Saya
                </Link>
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Pengaturan
                </Link>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
EOF
```

### 13.3 Create Main Layout

```bash
# src/app/(dashboard)/layout.tsx
cat > src/app/(dashboard)/layout.tsx << 'EOF'
'use client';

import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { useRequireAuth } from '@/hooks/useAuth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useRequireAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="pl-64">
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
EOF
```

### 13.4 Create Breadcrumb Component

```bash
# src/components/layout/Breadcrumb.tsx
cat > src/components/layout/Breadcrumb.tsx << 'EOF'
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  attendance: 'Kehadiran',
  leave: 'Cuti',
  overtime: 'Lembur',
  payroll: 'Payroll',
  employees: 'Karyawan',
  shift: 'Shift',
  social: 'Sosial',
  reports: 'Laporan',
  settings: 'Pengaturan',
  'check-in': 'Check-in',
  history: 'Riwayat',
  report: 'Laporan',
  request: 'Pengajuan',
  quota: 'Kuota',
  approvals: 'Persetujuan',
  slips: 'Slip Gaji',
  'cash-advances': 'Kasbon',
  bpjs: 'BPJS',
  tax: 'Pajak',
  feed: 'Feed',
  messages: 'Pesan',
  forum: 'Forum',
  announcements: 'Pengumuman',
};

export default function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      <Link href="/dashboard" className="flex items-center hover:text-blue-600">
        <Home className="h-4 w-4" />
      </Link>
      
      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/');
        const label = routeLabels[segment] || segment;
        const isLast = index === segments.length - 1;

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="text-gray-900 font-medium capitalize">{label}</span>
            ) : (
              <Link href={href} className="hover:text-blue-600 capitalize">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
EOF
```

### 13.5 Create 404 Page

```bash
# src/app/not-found.tsx
cat > src/app/not-found.tsx << 'EOF'
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-lg text-gray-600">
          Halaman tidak ditemukan
        </p>
        <Link href="/dashboard" className="mt-6 btn btn-primary">
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
EOF
```

### 13.6 Create Error Page

```bash
# src/app/error.tsx
cat > src/app/error.tsx << 'EOF'
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Terjadi Kesalahan</h1>
        <p className="mt-4 text-gray-600">{error.message}</p>
        <button onClick={reset} className="mt-6 btn btn-primary">
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
EOF
```

---

## Verification Checklist

- [ ] Sidebar menampilkan semua menu
- [ ] Menu sesuai role user
- [ ] Sidebar bisa collapse
- [ ] Header menampilkan user info
- [ ] Dropdown user menu bekerja
- [ ] Logout berfungsi
- [ ] Notifications bell ditampilkan
- [ ] Layout responsif
- [ ] Breadcrumb navigasi bekerja
- [ ] Loading state ditampilkan
- [ ] Permission check untuk role

---

## Next Phase

Setelah Phase 13 selesai, lanjut ke:
**[Phase 14: Frontend Dashboard](./PHASE-14-FRONTEND-DASHBOARD.md)**