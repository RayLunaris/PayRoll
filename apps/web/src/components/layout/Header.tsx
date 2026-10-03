'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell,
  UserCircle,
  LogOut,
  MessageCircle,
  ChevronDown,
  Menu,
} from 'lucide-react'
import type { UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { useState, useRef, useEffect } from 'react'
import GlobalSearch from '@/components/layout/GlobalSearch'

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  hr_admin: 'HR Admin',
  manager: 'Manager',
  employee: 'Karyawan',
}

export default function Header({ onMobileMenu }: { onMobileMenu?: () => void }) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const unreadNotificationsCount = useNotificationStore((state) => state.unreadNotificationsCount)
  const unreadMessagesCount = useNotificationStore((state) => state.unreadMessagesCount)
  const fetchUnreadCounts = useNotificationStore((state) => state.fetchUnreadCounts)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return

    // Initial fetch
    void fetchUnreadCounts()

    // Periodic polling every 15 seconds
    const interval = setInterval(() => {
      void fetchUnreadCounts()
    }, 15000)

    // Refresh when user returns to window tab
    const handleFocus = () => {
      void fetchUnreadCounts()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user, fetchUnreadCounts])

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
      <div className="flex min-h-16 items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={onMobileMenu}
          aria-label="Buka menu navigasi"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Global Search */}
        <GlobalSearch />

        {/* Right side items */}
        <div className="flex items-center gap-2.5">
          {/* Notifications */}
          <Link
            href="/notifications"
            aria-label="Notifikasi"
            title="Notifikasi"
            className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <Bell className="h-4 w-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm animate-in fade-in">
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </Link>

          {/* Messages */}
          <Link
            href="/social/messages"
            aria-label="Pesan"
            title="Pesan"
            className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <MessageCircle className="h-4 w-4" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm animate-in fade-in">
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
              </span>
            )}
          </Link>

          {/* Vertical Divider */}
          <div className="h-5 w-px bg-gray-200 mx-1" />

          {/* User menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              aria-label="Menu akun"
              aria-expanded={showDropdown}
              className="flex min-h-11 min-w-11 items-center justify-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-gray-50 md:min-w-0"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-semibold text-xs text-white uppercase select-none">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden text-left md:block">
                <div className="text-xs font-semibold text-gray-900 leading-tight">
                  {user?.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-[11px] text-gray-500 leading-tight mt-0.5">
                  {user ? roleLabels[user.role] : ''}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <Link
                  href="/settings"
                  className="flex min-h-11 items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Pengaturan
                </Link>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
