'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  UserCircle,
  LogOut,
  MessageCircle,
  ChevronDown,
} from 'lucide-react'
import type { UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useState, useRef, useEffect } from 'react'
import GlobalSearch from '@/components/layout/GlobalSearch'

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  hr_admin: 'HR Admin',
  manager: 'Manager',
  employee: 'Karyawan',
}

export default function Header() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Global Search */}
        <GlobalSearch />

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
            aria-label="Pesan"
            title="Pesan"
            className="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </Link>

          {/* Notifications */}
          <Link
            href="/notifications"
            aria-label="Notifikasi"
            title="Notifikasi"
            className="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </Link>

          {/* User menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              aria-label="Menu akun"
              aria-expanded={showDropdown}
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                <UserCircle className="h-6 w-6 text-white" />
              </div>
              <div className="hidden text-left md:block">
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
              <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Pengaturan
                </Link>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
  )
}