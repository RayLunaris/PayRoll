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
  employee: 'Statistik Karyawan',
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
  users: 'Manajemen User',
  password: 'Ubah Password',
  locations: 'Lokasi',
  departments: 'Departemen',
  feed: 'Feed',
  messages: 'Pesan',
  forum: 'Forum',
  announcements: 'Pengumuman',
  notifications: 'Notifikasi',
};

export default function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
        <li className="flex items-center">
          <Link
            href="/dashboard"
            aria-label="Dashboard"
            className="flex items-center hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-0.5"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Dashboard</span>
          </Link>
        </li>

        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/')
          const label = routeLabels[segment] || segment
          const isLast = index === segments.length - 1

          return (
            <li key={href} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-gray-900 capitalize"
                >
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  className="capitalize hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-0.5"
                >
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}