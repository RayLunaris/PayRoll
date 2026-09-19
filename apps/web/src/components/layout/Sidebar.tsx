'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
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
  Repeat,
  ChevronLeft,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

interface MenuItem {
  label: string
  icon: ReactNode
  href: string
  roles?: string[]
  children?: { label: string; href: string; roles?: string[] }[]
}

export default function Sidebar() {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const collapsed = useUIStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)

  const isVisible = (roles?: string[]) => {
    if (!roles) return true
    if (!user) return false
    return roles.includes(user.role)
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

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
        { label: 'Deteksi Pelanggaran', href: '/attendance/abuse', roles: ['hr_admin', 'manager', 'super_admin'] },
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
        { label: 'Kalender Cuti', href: '/leave/calendar' },
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
      icon: <Repeat className="h-5 w-5" />,
      href: '/shift',
      children: [
        { label: 'Manajemen Shift', href: '/shift' },
        { label: 'Kalender Shift', href: '/shift/calendar' },
        { label: 'Penugasan Shift', href: '/shift/assign', roles: ['hr_admin', 'manager', 'super_admin'] },
        { label: 'Tukar Shift', href: '/shift/swap' },
      ],
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
    },
  ]

  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 h-screen bg-slate-900 text-white transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-500">P</span>
            <span className="font-semibold">PayrollPro</span>
          </Link>
        )}
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          className="rounded-lg p-1 transition-colors hover:bg-slate-800"
        >
          <ChevronLeft className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="h-[calc(100vh-4rem)] space-y-1 overflow-y-auto p-4">
        {menuItems.map((item) => {
          if (!isVisible(item.roles)) return null

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2 transition-colors
                  ${isActive(item.href)
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
                    if (!isVisible(child.roles)) return null
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`
                          block rounded-lg px-3 py-1.5 text-sm transition-colors
                          ${pathname === child.href
                            ? 'bg-blue-600/50 text-white'
                            : 'text-gray-400 hover:bg-slate-800 hover:text-white'}
                        `}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}