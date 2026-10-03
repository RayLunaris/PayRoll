'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  ChevronDown,
  ChevronRight,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  Check,
  PieChart,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

export interface NavItemData {
  id: string
  title: string
  icon: React.ElementType
  href: string
  badge?: number | string
  shortcut?: string
  roles?: string[]
  children?: {
    id: string
    title: string
    href: string
    roles?: string[]
  }[]
}

export interface NavGroupData {
  heading?: string
  items: NavItemData[]
}

const navGroups: NavGroupData[] = [
  {
    items: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        icon: LayoutDashboard,
        href: '/dashboard',
      },
    ],
  },
  {
    heading: 'Operasional',
    items: [
      {
        id: 'attendance',
        title: 'Kehadiran',
        icon: CalendarCheck,
        href: '/attendance',
        children: [
          { id: 'att-checkin', title: 'Check-in / Check-out', href: '/attendance/check-in' },
          { id: 'att-history', title: 'Riwayat Kehadiran', href: '/attendance/history' },
          { id: 'att-report', title: 'Laporan Kehadiran', href: '/attendance/report', roles: ['hr_admin', 'manager', 'super_admin'] },
          { id: 'att-abuse', title: 'Deteksi Pelanggaran', href: '/attendance/abuse', roles: ['hr_admin', 'manager', 'super_admin'] },
        ],
      },
      {
        id: 'leave',
        title: 'Cuti',
        icon: CalendarDays,
        href: '/leave',
        children: [
          { id: 'leave-req', title: 'Pengajuan Cuti', href: '/leave/request' },
          { id: 'leave-hist', title: 'Riwayat Cuti', href: '/leave/history' },
          { id: 'leave-quota', title: 'Kuota Cuti', href: '/leave/quota' },
          { id: 'leave-cal', title: 'Kalender Cuti', href: '/leave/calendar' },
          { id: 'leave-appr', title: 'Persetujuan Cuti', href: '/leave/approvals', roles: ['hr_admin', 'manager', 'super_admin'] },
        ],
      },
      {
        id: 'overtime',
        title: 'Lembur',
        icon: Clock,
        href: '/overtime',
        children: [
          { id: 'ot-req', title: 'Pengajuan Lembur', href: '/overtime/request' },
          { id: 'ot-hist', title: 'Riwayat Lembur', href: '/overtime/history' },
          { id: 'ot-appr', title: 'Persetujuan Lembur', href: '/overtime/approvals', roles: ['hr_admin', 'manager', 'super_admin'] },
        ],
      },
      {
        id: 'shift',
        title: 'Shift Kerja',
        icon: Repeat,
        href: '/shift',
        children: [
          { id: 'shift-manage', title: 'Manajemen Shift', href: '/shift' },
          { id: 'shift-cal', title: 'Kalender Shift', href: '/shift/calendar' },
          { id: 'shift-assign', title: 'Penugasan Shift', href: '/shift/assign', roles: ['hr_admin', 'manager', 'super_admin'] },
          { id: 'shift-swap', title: 'Tukar Shift', href: '/shift/swap' },
        ],
      },
    ],
  },
  {
    heading: 'Finansial & SDM',
    items: [
      {
        id: 'payroll',
        title: 'Payroll',
        icon: Wallet,
        href: '/payroll',
        children: [
          { id: 'pay-slips', title: 'Slip Gaji', href: '/payroll/slips' },
          { id: 'pay-adv', title: 'Kasbon', href: '/payroll/cash-advances' },
          { id: 'pay-proc', title: 'Proses Payroll', href: '/payroll/process', roles: ['hr_admin', 'super_admin'] },
          { id: 'pay-bpjs', title: 'Laporan BPJS', href: '/payroll/bpjs', roles: ['hr_admin', 'super_admin'] },
          { id: 'pay-tax', title: 'Laporan Pajak', href: '/payroll/tax', roles: ['hr_admin', 'super_admin'] },
        ],
      },
      {
        id: 'employees',
        title: 'Karyawan',
        icon: Users,
        href: '/employees',
        roles: ['hr_admin', 'super_admin'],
      },
      {
        id: 'budgets',
        title: 'Anggaran & Proyek',
        icon: PieChart,
        href: '/admin/budgets',
        roles: ['hr_admin', 'super_admin', 'manager'],
        children: [
          { id: 'budgets-summary', title: 'Ringkasan Anggaran', href: '/admin/budgets', roles: ['hr_admin', 'super_admin'] },
          { id: 'budgets-projects', title: 'Proyek & Alokasi Biaya', href: '/admin/projects', roles: ['hr_admin', 'manager', 'super_admin'] },
        ],
      },
    ],
  },
  {
    heading: 'Kolaborasi & Laporan',
    items: [
      {
        id: 'social',
        title: 'Sosial',
        icon: MessageCircle,
        href: '/social',
        children: [
          { id: 'soc-feed', title: 'Feed', href: '/social/feed' },
          { id: 'soc-msg', title: 'Pesan', href: '/social/messages' },
          { id: 'soc-forum', title: 'Forum', href: '/social/forum' },
          { id: 'soc-ann', title: 'Pengumuman', href: '/social/announcements' },
        ],
      },
      {
        id: 'reports',
        title: 'Laporan',
        icon: BarChart3,
        href: '/reports',
        roles: ['hr_admin', 'manager', 'super_admin'],
      },
    ],
  },
]

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [workspace, setWorkspace] = useState('PT PayrollPro Indonesia')

  const workspaces = [
    'PT PayrollPro Indonesia',
  ]

  const canSwitch = workspaces.length > 1

  if (collapsed) {
    return (
      <div className="flex justify-center mb-4">
        <div
          title={workspace}
          className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm"
        >
          P
        </div>
      </div>
    )
  }

  return (
    <div className="relative mb-3">
      <div
        onClick={() => canSwitch && setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors select-none group border border-slate-200 bg-white ${
          canSwitch ? 'hover:bg-slate-50 cursor-pointer' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center font-bold text-[13px] shadow-sm shrink-0">
            P
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold leading-tight text-slate-800 truncate">
              {workspace}
            </span>
            <span className="text-[11px] text-slate-500 leading-tight mt-0.5">
              Enterprise HRMS
            </span>
          </div>
        </div>
        {canSwitch && (
          <ChevronDown
            className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0 ml-1"
            strokeWidth={1.5}
          />
        )}
      </div>

      {canSwitch && isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-[48px] left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
            {workspaces.map((ws) => (
              <div
                key={ws}
                onClick={() => {
                  setWorkspace(ws)
                  setIsOpen(false)
                }}
                className={`px-3 py-2 mx-1 text-[13px] rounded-md cursor-pointer transition-colors flex items-center justify-between ${
                  workspace === ws
                    ? 'bg-blue-50 text-blue-800 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="truncate">{ws}</span>
                {workspace === ws && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function NavItem({
  item,
  pathname,
  collapsed,
  level = 0,
  userRole,
}: {
  item: NavItemData
  pathname: string
  collapsed: boolean
  level?: number
  userRole?: string
}) {
  const isVisible = (roles?: string[]) => {
    if (!roles) return true
    if (!userRole) return false
    return roles.includes(userRole)
  }

  const visibleChildren = item.children?.filter((c) => isVisible(c.roles)) || []
  const hasChildren = visibleChildren.length > 0
  const isItemActive =
    pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))

  const [isOpen, setIsOpen] = useState(isItemActive)

  useEffect(() => {
    if (isItemActive) {
      setIsOpen(true)
    }
  }, [isItemActive])

  if (!isVisible(item.roles)) return null

  if (collapsed) {
    return (
      <Link
        href={item.href}
        title={item.title}
        className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all duration-200 ${
          isItemActive
            ? 'bg-blue-50 text-blue-800 font-medium'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <item.icon className="w-[15px] h-[15px]" strokeWidth={1.75} />
      </Link>
    )
  }

  return (
    <div className="flex flex-col w-full">
      <div
        className={`group flex items-center justify-between px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none ${
          isItemActive
            ? 'bg-blue-50 text-blue-800 font-medium'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
        style={{ paddingLeft: `${level * 12 + 10}px` }}
        onClick={() => {
          if (hasChildren) {
            setIsOpen(!isOpen)
          }
        }}
      >
        <Link
          href={hasChildren ? '#' : item.href}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault()
              setIsOpen(!isOpen)
            }
          }}
          className="flex items-center gap-2.5 min-w-0 flex-1"
        >
          <item.icon
            className="w-[15px] h-[15px] shrink-0"
            strokeWidth={1.75}
          />
          <span className="text-[13px] tracking-wide truncate">{item.title}</span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {item.shortcut && (
          <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-slate-500 bg-slate-100 border border-slate-200 rounded-[4px]">
              {item.shortcut}
            </kbd>
          )}
          {item.badge && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-800">
              {item.badge}
            </span>
          )}
          {hasChildren && (
            <ChevronRight
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isOpen ? 'rotate-90' : ''
              }`}
              strokeWidth={2}
            />
          )}
        </div>
      </div>

      {hasChildren && (
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0 relative flex flex-col gap-0.5 mt-0.5">
            <div
              className="absolute top-0 bottom-0 border-l border-slate-200"
              style={{ left: `${level * 12 + 18}px` }}
            />
            {visibleChildren.map((child) => {
              const isChildActive = pathname === child.href
              return (
                <Link
                  key={child.id}
                  href={child.href}
                  className={`group flex items-center justify-between py-[6px] pr-2.5 rounded-[6px] cursor-pointer transition-all duration-150 select-none ${
                    isChildActive
                      ? 'bg-blue-50 text-blue-800 font-medium'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  style={{ paddingLeft: `${(level + 1) * 12 + 16}px` }}
                >
                  <span className="text-[12.5px] truncate">{child.title}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const collapsed = useUIStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      onMobileClose?.()
      previousPathname.current = pathname
    }
  }, [pathname, onMobileClose])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          className="fixed inset-0 z-[900] bg-slate-950/35 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
      className={`fixed left-0 top-0 z-[1000] flex h-[100dvh] w-[min(86vw,16rem)] flex-col border-r border-slate-200 p-3 transition-transform duration-300 md:z-40 md:h-screen md:translate-x-0 md:transition-[width] ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } ${collapsed ? 'md:w-16 md:p-2' : 'md:w-64 md:p-3'}`}
      style={{ backgroundColor: '#f8fafc' }}
    >
      {/* Top Header / Switcher & Collapse Button */}
      <div className="flex items-center justify-between pb-2 mb-1">
        <WorkspaceSwitcher collapsed={collapsed} />

        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 md:h-9 md:w-9"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-[15px] h-[15px]" strokeWidth={1.5} />
          ) : (
            <PanelLeftClose className="w-[15px] h-[15px]" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-4">
        {navGroups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {group.heading && !collapsed && (
              <span
                className="px-2.5 mb-1 tracking-wider uppercase font-normal select-none"
                style={{
                  fontSize: '10px',
                  color: '#64748b',
                  letterSpacing: '0.05em',
                }}
              >
                {group.heading}
              </span>
            )}
            {group.items.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                userRole={user?.role}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom Nav Items */}
      <div className="mt-auto pt-3 border-t border-slate-200 flex flex-col gap-0.5">
        <Link
          href="/settings"
          title="Pengaturan"
          className={`group flex items-center justify-between px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none ${
            pathname.startsWith('/settings')
              ? 'bg-blue-50 text-blue-800 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          } ${collapsed ? 'justify-center w-10 h-10 mx-auto px-0' : ''}`}
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-[15px] h-[15px]" strokeWidth={1.75} />
            {!collapsed && <span className="text-[13px] tracking-wide">Pengaturan</span>}
          </div>
          {!collapsed && (
            <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-slate-500 bg-slate-100 border border-slate-200 rounded-[4px]">
              ⌘,
            </kbd>
          )}
        </Link>

        <button
          onClick={handleLogout}
          title="Keluar"
          style={{ color: '#dc2626' }}
          className={`group flex items-center justify-between px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none hover:bg-red-50 ${
            collapsed ? 'justify-center w-10 h-10 mx-auto px-0' : ''
          }`}
        >
          <div className="flex items-center gap-2.5">
            <LogOut className="w-[15px] h-[15px]" strokeWidth={1.75} />
            {!collapsed && <span className="text-[13px] tracking-wide">Keluar</span>}
          </div>
        </button>
      </div>
      </aside>
    </>
  )
}
