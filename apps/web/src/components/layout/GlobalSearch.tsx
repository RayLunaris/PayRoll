'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  X,
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Clock,
  Repeat,
  Wallet,
  Users,
  MessageCircle,
  BarChart3,
  Settings,
  Bell,
  User,
  ArrowRight,
  Sparkles,
  Loader2,
  FileText,
  Building2,
  ShieldAlert,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import api from '@/lib/api'
import type { UserRole } from '@/types'

interface SearchItem {
  id: string
  title: string
  subtitle?: string
  href: string
  icon: React.ElementType
  category: 'menu' | 'action'
  keywords?: string[]
  roles?: UserRole[]
}

interface EmployeeResult {
  id: string
  nip: string
  fullName: string
  departmentId?: string
  isActive?: boolean
}

const SEARCH_ITEMS: SearchItem[] = [
  // Menu & Halaman
  {
    id: 'menu-dashboard',
    title: 'Dashboard',
    subtitle: 'Ringkasan metrik, grafik analitik, dan aktivitas terkini',
    href: '/dashboard',
    icon: LayoutDashboard,
    category: 'menu',
    keywords: ['beranda', 'home', 'ringkasan', 'overview'],
  },
  {
    id: 'menu-attendance-checkin',
    title: 'Presensi / Check-in',
    subtitle: 'Absen masuk, absen keluar, verifikasi wajah & lokasi GPS',
    href: '/attendance/check-in',
    icon: CalendarCheck,
    category: 'menu',
    keywords: ['absen', 'kehadiran', 'clock in', 'clock out', 'selfie', 'foto'],
  },
  {
    id: 'menu-attendance-history',
    title: 'Riwayat Kehadiran',
    subtitle: 'Daftar catatan jam masuk, pulang, dan status kehadiran pribadi',
    href: '/attendance/history',
    icon: CalendarCheck,
    category: 'menu',
    keywords: ['log absen', 'jam kerja', 'rekap kehadiran'],
  },
  {
    id: 'menu-attendance-report',
    title: 'Laporan Kehadiran',
    subtitle: 'Rekap kehadiran karyawan dan ekspor laporan',
    href: '/attendance/report',
    icon: CalendarCheck,
    category: 'menu',
    roles: ['hr_admin', 'manager', 'super_admin'],
    keywords: ['rekap absen', 'laporan bulanan', 'kehadiran departemen'],
  },
  {
    id: 'menu-attendance-abuse',
    title: 'Deteksi Pelanggaran Presensi',
    subtitle: 'Deteksi kecurangan lokasi GPS spoofing dan anomali absensi',
    href: '/attendance/abuse',
    icon: ShieldAlert,
    category: 'menu',
    roles: ['hr_admin', 'manager', 'super_admin'],
    keywords: ['fraud', 'fake gps', 'spoofing', 'pelanggaran', 'anomali'],
  },
  {
    id: 'menu-leave-request',
    title: 'Pengajuan Cuti',
    subtitle: 'Formulir permohonan cuti tahunan, sakit, atau izin',
    href: '/leave/request',
    icon: CalendarDays,
    category: 'menu',
    keywords: ['ajukan cuti', 'izin', 'sakit', 'libur', 'permohonan'],
  },
  {
    id: 'menu-leave-history',
    title: 'Riwayat Cuti',
    subtitle: 'Daftar permohonan cuti yang telah diajukan dan statusnya',
    href: '/leave/history',
    icon: CalendarDays,
    category: 'menu',
    keywords: ['status cuti', 'daftar permohonan cuti'],
  },
  {
    id: 'menu-leave-quota',
    title: 'Kuota Cuti',
    subtitle: 'Cek sisa kuota hak cuti tahunan karyawan',
    href: '/leave/quota',
    icon: CalendarDays,
    category: 'menu',
    keywords: ['sisa cuti', 'saldo cuti', 'hak cuti'],
  },
  {
    id: 'menu-leave-calendar',
    title: 'Kalender Cuti',
    subtitle: 'Jadwal cuti tim dan hari libur nasional',
    href: '/leave/calendar',
    icon: CalendarDays,
    category: 'menu',
    keywords: ['jadwal cuti', 'libur nasional', 'tanggal merah'],
  },
  {
    id: 'menu-leave-approvals',
    title: 'Persetujuan Cuti',
    subtitle: 'Tinjau dan setujui atau tolak permohonan cuti bawahan',
    href: '/leave/approvals',
    icon: CalendarDays,
    category: 'menu',
    roles: ['hr_admin', 'manager', 'super_admin'],
    keywords: ['approval cuti', 'persetujuan cuti', 'verifikasi cuti'],
  },
  {
    id: 'menu-overtime-request',
    title: 'Pengajuan Lembur',
    subtitle: 'Formulir permohonan lembur kerja di luar jam kerja normal',
    href: '/overtime/request',
    icon: Clock,
    category: 'menu',
    keywords: ['lembur', 'overtime', 'permohonan lembur', 'jam tambahan'],
  },
  {
    id: 'menu-overtime-history',
    title: 'Riwayat Lembur',
    subtitle: 'Catatan waktu lembur dan status pembayarannya',
    href: '/overtime/history',
    icon: Clock,
    category: 'menu',
    keywords: ['log lembur', 'daftar lembur', 'jam lembur'],
  },
  {
    id: 'menu-overtime-approvals',
    title: 'Persetujuan Lembur',
    subtitle: 'Verifikasi dan persetujuan pengajuan lembur tim',
    href: '/overtime/approvals',
    icon: Clock,
    category: 'menu',
    roles: ['hr_admin', 'manager', 'super_admin'],
    keywords: ['approval lembur', 'persetujuan lembur'],
  },
  {
    id: 'menu-shift-manage',
    title: 'Manajemen Shift',
    subtitle: 'Daftar jadwal giliran shift kerja (Pagi, Siang, Malam)',
    href: '/shift',
    icon: Repeat,
    category: 'menu',
    keywords: ['jadwal shift', 'pola kerja', 'gilir kerja'],
  },
  {
    id: 'menu-shift-calendar',
    title: 'Kalender Shift',
    subtitle: 'Tampilan kalender penugasan shift bulanan',
    href: '/shift/calendar',
    icon: Repeat,
    category: 'menu',
    keywords: ['kalender kerja', 'jadwal bulanan shift'],
  },
  {
    id: 'menu-shift-assign',
    title: 'Penugasan Shift',
    subtitle: 'Atur dan tugaskan shift untuk anggota tim dan divisi',
    href: '/shift/assign',
    icon: Repeat,
    category: 'menu',
    roles: ['hr_admin', 'manager', 'super_admin'],
    keywords: ['tugas shift', 'assign shift karyawan'],
  },
  {
    id: 'menu-shift-swap',
    title: 'Tukar Shift',
    subtitle: 'Pengajuan dan persetujuan tukar jadwal shift antar rekan',
    href: '/shift/swap',
    icon: Repeat,
    category: 'menu',
    keywords: ['tukar jadwal', 'ganti shift'],
  },
  {
    id: 'menu-payroll-overview',
    title: 'Payroll',
    subtitle: 'Ringkasan penggajian dan komponen kompensasi',
    href: '/payroll',
    icon: Wallet,
    category: 'menu',
    keywords: ['gaji', 'upah', 'penggajian', 'sallary'],
  },
  {
    id: 'menu-payroll-slips',
    title: 'Slip Gaji',
    subtitle: 'Lihat rincian take home pay dan unduh slip gaji bulanan',
    href: '/payroll/slips',
    icon: FileText,
    category: 'menu',
    keywords: ['payslip', 'unduh slip', 'gaji bulanan', 'thp', 'take home pay'],
  },
  {
    id: 'menu-payroll-cash-advances',
    title: 'Kasbon / Pinjaman',
    subtitle: 'Pengajuan pinjaman uang muka gaji dan riwayat cicilan',
    href: '/payroll/cash-advances',
    icon: Wallet,
    category: 'menu',
    keywords: ['pinjaman karyawan', 'bon', 'uang muka', 'kasbon'],
  },
  {
    id: 'menu-payroll-process',
    title: 'Proses Payroll',
    subtitle: 'Hitung gaji seluruh karyawan, kalkulasi BPJS dan PPh 21',
    href: '/payroll/process',
    icon: Wallet,
    category: 'menu',
    roles: ['hr_admin', 'super_admin'],
    keywords: ['hitung gaji', 'generate payroll', 'disbursement', 'payroll run'],
  },
  {
    id: 'menu-payroll-bpjs',
    title: 'Laporan BPJS',
    subtitle: 'Rekapitulasi iuran BPJS Kesehatan dan Ketenagakerjaan',
    href: '/payroll/bpjs',
    icon: Wallet,
    category: 'menu',
    roles: ['hr_admin', 'super_admin'],
    keywords: ['iuran bpjs', 'bpjs ketenagakerjaan', 'bpjs kesehatan', 'jht', 'jp', 'jkk', 'jkm'],
  },
  {
    id: 'menu-payroll-tax',
    title: 'Laporan Pajak PPh 21',
    subtitle: 'Kalkulasi tarif efektif rata-rata (TER) dan bukti potong pajak',
    href: '/payroll/tax',
    icon: Wallet,
    category: 'menu',
    roles: ['hr_admin', 'super_admin'],
    keywords: ['pph 21', 'pajak penghasilan', 'ter pph', 'bukti potong 1721-a1'],
  },
  {
    id: 'menu-employees',
    title: 'Data Karyawan',
    subtitle: 'Direktori pegawai, informasi profil, departemen, dan jabatan',
    href: '/employees',
    icon: Users,
    category: 'menu',
    roles: ['hr_admin', 'super_admin'],
    keywords: ['pegawai', 'staff', 'sdm', 'daftar karyawan', 'nip'],
  },
  {
    id: 'menu-employees-add',
    title: 'Tambah Karyawan',
    subtitle: 'Pendaftaran data pegawai baru ke dalam sistem HRMS',
    href: '/employees/add',
    icon: Users,
    category: 'menu',
    roles: ['hr_admin', 'super_admin'],
    keywords: ['karyawan baru', 'tambah staf', 'registrasi pegawai'],
  },
  {
    id: 'menu-social-feed',
    title: 'Social Feed',
    subtitle: 'Feed aktivitas internal, postingan kabar, dan update tim',
    href: '/social/feed',
    icon: MessageCircle,
    category: 'menu',
    keywords: ['feed', 'linimasa', 'postingan', 'komunitas'],
  },
  {
    id: 'menu-social-messages',
    title: 'Pesan / Direct Messages',
    subtitle: 'Obrolan pribadi real-time antar rekan kerja perusahaan',
    href: '/social/messages',
    icon: MessageCircle,
    category: 'menu',
    keywords: ['chat', 'pesan langsung', 'dm', 'obrolan'],
  },
  {
    id: 'menu-social-forum',
    title: 'Forum Diskusi',
    subtitle: 'Ruang tanya jawab, diskusi topik kerja, dan ide inovasi',
    href: '/social/forum',
    icon: MessageCircle,
    category: 'menu',
    keywords: ['forum', 'diskusi', 'tanya jawab', 'qna'],
  },
  {
    id: 'menu-social-announcements',
    title: 'Pengumuman Perusahaan',
    subtitle: 'Siaran berita, pengumuman resmi dari manajemen HR',
    href: '/social/announcements',
    icon: Bell,
    category: 'menu',
    keywords: ['pengumuman', 'broadcast', 'edaran', 'kabar resmi'],
  },
  {
    id: 'menu-reports',
    title: 'Laporan & Analitik',
    subtitle: 'Statistik demografi pegawai, tren presensi, dan analitik biaya',
    href: '/reports',
    icon: BarChart3,
    category: 'menu',
    roles: ['hr_admin', 'manager', 'super_admin'],
    keywords: ['laporan sdm', 'grafik turnover', 'analisis biaya', 'rekap'],
  },
  {
    id: 'menu-notifications',
    title: 'Notifikasi',
    subtitle: 'Pemberitahuan aktivitas persetujuan, chat, dan sistem',
    href: '/notifications',
    icon: Bell,
    category: 'menu',
    keywords: ['notif', 'pemberitahuan', 'inbox'],
  },
  {
    id: 'menu-settings',
    title: 'Pengaturan Sistem',
    subtitle: 'Konfigurasi akun, master data departemen, jabatan, dan aturan',
    href: '/settings',
    icon: Settings,
    category: 'menu',
    keywords: ['pengaturan', 'konfigurasi', 'setting', 'preferensi'],
  },
  {
    id: 'menu-settings-departments',
    title: 'Pengaturan Departemen',
    subtitle: 'Kelola struktur divisi dan departemen kerja',
    href: '/settings/departments',
    icon: Building2,
    category: 'menu',
    roles: ['hr_admin', 'super_admin'],
    keywords: ['divisi', 'departemen', 'struktur organisasi'],
  },
  {
    id: 'menu-settings-positions',
    title: 'Pengaturan Jabatan',
    subtitle: 'Master data jabatan kerja, grade, dan standar gaji pokok',
    href: '/settings/positions',
    icon: Settings,
    category: 'menu',
    roles: ['hr_admin', 'super_admin'],
    keywords: ['posisi', 'jabatan', 'grade', 'gaji pokok standar'],
  },
  {
    id: 'menu-settings-locations',
    title: 'Pengaturan Lokasi Kantor',
    subtitle: 'Kelola titik koordinat kantor dan radius geofence presensi',
    href: '/settings/locations',
    icon: Settings,
    category: 'menu',
    roles: ['hr_admin', 'super_admin'],
    keywords: ['lokasi presensi', 'geofence', 'koordinat gps', 'radius kantor'],
  },
  {
    id: 'menu-settings-users',
    title: 'Pengaturan Pengguna & Akses',
    subtitle: 'Manajemen akun login, peran (role), dan status aktif pengguna',
    href: '/settings/users',
    icon: Users,
    category: 'menu',
    roles: ['hr_admin', 'super_admin'],
    keywords: ['manajemen user', 'role', 'hak akses', 'email login'],
  },

  // Aksi Cepat
  {
    id: 'act-checkin',
    title: 'Check-in / Absen Sekarang',
    subtitle: 'Catat presensi kehadiran hari ini dengan verifikasi GPS',
    href: '/attendance/check-in',
    icon: Sparkles,
    category: 'action',
    keywords: ['absen sekarang', 'clock in cepat'],
  },
  {
    id: 'act-leave-req',
    title: 'Ajukan Permohonan Cuti Baru',
    subtitle: 'Buka formulir pengajuan cuti tahunan atau izin sakit',
    href: '/leave/request',
    icon: Sparkles,
    category: 'action',
    keywords: ['buat cuti', 'minta izin', 'ajukan cuti'],
  },
  {
    id: 'act-ot-req',
    title: 'Ajukan Lembur Baru',
    subtitle: 'Kirim permohonan lembur ke atasan/manajer',
    href: '/overtime/request',
    icon: Sparkles,
    category: 'action',
    keywords: ['buat lembur', 'lembur baru'],
  },
  {
    id: 'act-cash-req',
    title: 'Ajukan Pinjaman Kasbon',
    subtitle: 'Buka pengajuan kasbon atau uang muka gaji',
    href: '/payroll/cash-advances',
    icon: Sparkles,
    category: 'action',
    keywords: ['kasbon baru', 'pinjam gaji', 'uang muka'],
  },
  {
    id: 'act-new-msg',
    title: 'Buka Obrolan / Pesan Baru',
    subtitle: 'Kirim pesan langsung ke rekan kerja',
    href: '/social/messages',
    icon: Sparkles,
    category: 'action',
    keywords: ['chat rekan', 'kirim pesan'],
  },
]

export default function GlobalSearch() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isMac, setIsMac] = useState(false)
  
  // Employee search state
  const [employees, setEmployees] = useState<EmployeeResult[]>([])
  const [isSearchingEmployees, setIsSearchingEmployees] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  // Detect platform for shortcut display (⌘K vs Ctrl+K)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || ''))
    }
  }, [])

  // Global hotkey: Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 10)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter items by role and query
  const filteredNavigation = useMemo(() => {
    const userRole = user?.role

    // Filter by role
    const roleAllowed = SEARCH_ITEMS.filter((item) => {
      if (!item.roles) return true
      if (!userRole) return false
      return item.roles.includes(userRole)
    })

    const trimmed = query.trim().toLowerCase()
    if (!trimmed) {
      // Default: recommendations (first 4 menus and 3 actions)
      return {
        menus: roleAllowed.filter((i) => i.category === 'menu').slice(0, 4),
        actions: roleAllowed.filter((i) => i.category === 'action').slice(0, 3),
      }
    }

    const matches = roleAllowed.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(trimmed)
      const matchSubtitle = item.subtitle?.toLowerCase().includes(trimmed)
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(trimmed))
      return matchTitle || matchSubtitle || matchKeywords
    })

    return {
      menus: matches.filter((i) => i.category === 'menu').slice(0, 6),
      actions: matches.filter((i) => i.category === 'action').slice(0, 4),
    }
  }, [query, user?.role])

  // Can user search employees? (HR, Super Admin, Manager)
  const canSearchEmployees = useMemo(() => {
    return user && ['hr_admin', 'super_admin', 'manager'].includes(user.role)
  }, [user])

  // Debounced search for employees
  useEffect(() => {
    const trimmed = query.trim()
    if (!canSearchEmployees || trimmed.length < 2) {
      setEmployees([])
      setIsSearchingEmployees(false)
      return
    }

    setIsSearchingEmployees(true)
    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.get<{ data: EmployeeResult[] }>(
          `/employees?search=${encodeURIComponent(trimmed)}&limit=5`
        )
        setEmployees(res.data.data || [])
      } catch (err) {
        console.error('Failed to search employees:', err)
        setEmployees([])
      } finally {
        setIsSearchingEmployees(false)
      }
    }, 220)

    return () => clearTimeout(timeoutId)
  }, [query, canSearchEmployees])

  // Flat list of selectable items for keyboard navigation
  const selectableItems = useMemo(() => {
    const list: Array<
      | { type: 'nav'; item: SearchItem }
      | { type: 'employee'; employee: EmployeeResult }
      | { type: 'employee-all'; query: string }
    > = []

    filteredNavigation.actions.forEach((item) => list.push({ type: 'nav', item }))
    filteredNavigation.menus.forEach((item) => list.push({ type: 'nav', item }))
    employees.forEach((emp) => list.push({ type: 'employee', employee: emp }))

    if (query.trim() && canSearchEmployees && employees.length > 0) {
      list.push({ type: 'employee-all', query: query.trim() })
    }

    return list
  }, [filteredNavigation, employees, query, canSearchEmployees])

  // Reset selected index when selectable list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [selectableItems.length])

  // Handle item selection/navigation
  const selectItem = useCallback(
    (index: number) => {
      const selected = selectableItems[index]
      if (!selected) {
        // If Enter is pressed and user is searching for something, navigate to employees list if allowed
        if (query.trim() && canSearchEmployees) {
          router.push(`/employees?search=${encodeURIComponent(query.trim())}`)
          setIsOpen(false)
          setQuery('')
          inputRef.current?.blur()
        }
        return
      }

      if (selected.type === 'nav') {
        router.push(selected.item.href)
      } else if (selected.type === 'employee') {
        router.push(`/employees/${selected.employee.id}`)
      } else if (selected.type === 'employee-all') {
        router.push(`/employees?search=${encodeURIComponent(selected.query)}`)
      }

      setIsOpen(false)
      setQuery('')
      inputRef.current?.blur()
    },
    [selectableItems, query, canSearchEmployees, router]
  )

  // Keyboard navigation within the dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, selectableItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + selectableItems.length) % Math.max(1, selectableItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectItem(selectedIndex)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  // Helper to get index in the flat selectable list
  const getNavIndex = (item: SearchItem) => {
    return selectableItems.findIndex((s) => s.type === 'nav' && s.item.id === item.id)
  }

  const getEmpIndex = (empId: string) => {
    return selectableItems.findIndex((s) => s.type === 'employee' && s.employee.id === empId)
  }

  const hasResults =
    filteredNavigation.actions.length > 0 ||
    filteredNavigation.menus.length > 0 ||
    employees.length > 0

  return (
    <div className="relative max-w-md flex-1" ref={containerRef}>
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search
          className={`absolute left-3.5 h-4 w-4 transition-colors pointer-events-none ${
            isOpen ? 'text-blue-600' : 'text-gray-400'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Cari menu, fitur, atau karyawan..."
          className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-2 pl-10 pr-16 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          aria-label="Cari menu, fitur, atau karyawan"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="global-search-results"
        />

        {/* Right side controls: Clear button & Shortcut indicator */}
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Hapus pencarian"
              aria-label="Hapus pencarian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400 shadow-sm pointer-events-none select-none">
              <span>{isMac ? '⌘' : 'Ctrl'}</span>
              <span>K</span>
            </kbd>
          )}
        </div>
      </div>

      {/* Floating Results Palette */}
      {isOpen && (
        <div
          id="global-search-results"
          ref={resultsContainerRef}
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[480px] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header indicator when typing */}
          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 mb-1">
            <span>
              {query.trim()
                ? `Hasil pencarian untuk "${query.trim()}"`
                : 'Rekomendasi Menu & Aksi Cepat'}
            </span>
            {isSearchingEmployees && (
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <Loader2 className="h-3 w-3 animate-spin" />
                Mencari karyawan...
              </span>
            )}
          </div>

          {!hasResults && !isSearchingEmployees && (
            <div className="py-8 text-center">
              <Search className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-700">Tidak ada hasil ditemukan</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Coba gunakan kata kunci lain seperti &quot;absen&quot;, &quot;cuti&quot;, &quot;gaji&quot;, atau nama rekan kerja.
              </p>
            </div>
          )}

          {/* 1. Quick Actions */}
          {filteredNavigation.actions.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Aksi Cepat
              </div>
              <div className="space-y-0.5">
                {filteredNavigation.actions.map((action) => {
                  const idx = getNavIndex(action)
                  const isSelected = selectedIndex === idx
                  const Icon = action.icon

                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => selectItem(idx)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold">{action.title}</div>
                          {action.subtitle && (
                            <div className="text-[11px] text-gray-400 truncate">
                              {action.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-300'}`} />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2. Employee Results */}
          {employees.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Data Karyawan
              </div>
              <div className="space-y-0.5">
                {employees.map((emp) => {
                  const idx = getEmpIndex(emp.id)
                  const isSelected = selectedIndex === idx

                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => selectItem(idx)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <span>{emp.fullName}</span>
                            <span className="rounded bg-gray-100 px-1.5 py-0.2 text-[10px] font-mono text-gray-600">
                              {emp.nip}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400">
                            Lihat profil detail karyawan
                          </div>
                        </div>
                      </div>
                      <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-300'}`} />
                    </button>
                  )
                })}

                {/* View all employee results */}
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/employees?search=${encodeURIComponent(query.trim())}`)
                      setIsOpen(false)
                      setQuery('')
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <span>Lihat semua hasil karyawan untuk &quot;{query.trim()}&quot;</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 3. Pages & Menu Items */}
          {filteredNavigation.menus.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Menu & Halaman
              </div>
              <div className="space-y-0.5">
                {filteredNavigation.menus.map((menu) => {
                  const idx = getNavIndex(menu)
                  const isSelected = selectedIndex === idx
                  const Icon = menu.icon

                  return (
                    <button
                      key={menu.id}
                      type="button"
                      onClick={() => selectItem(idx)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold">{menu.title}</div>
                          {menu.subtitle && (
                            <div className="text-[11px] text-gray-400 truncate">
                              {menu.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-2">
                        {menu.href}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer keyboard guide */}
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between px-3 text-[10px] text-gray-400">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border bg-gray-50 px-1 py-0.5 font-mono">↑</kbd>
                <kbd className="rounded border bg-gray-50 px-1 py-0.5 font-mono">↓</kbd>
                navigasi
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border bg-gray-50 px-1 py-0.5 font-mono">↵</kbd>
                pilih
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border bg-gray-50 px-1 py-0.5 font-mono">esc</kbd>
                tutup
              </span>
            </div>
            <span>PayrollPro HRMS</span>
          </div>
        </div>
      )}
    </div>
  )
}
