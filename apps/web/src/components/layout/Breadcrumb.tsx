'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  attendance: 'Kehadiran',
  leave: 'Cuti',
  overtime: 'Lembur',
  payroll: 'Payroll',
  employees: 'Karyawan',
  shift: 'Shift',
  calendar: 'Kalender',
  assign: 'Penugasan',
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
}

export default function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  return (
    <nav className="mb-4 flex items-center gap-1 text-sm text-gray-500">
      <Link href="/dashboard" className="flex items-center hover:text-blue-600">
        <Home className="h-4 w-4" />
      </Link>

      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/')
        const label = routeLabels[segment] || segment
        const isLast = index === segments.length - 1

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="font-medium text-gray-900 capitalize">{label}</span>
            ) : (
              <Link href={href} className="capitalize hover:text-blue-600">
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}