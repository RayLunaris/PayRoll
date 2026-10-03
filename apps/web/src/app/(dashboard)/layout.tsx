'use client'

import { useCallback, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import ToastContainer from '@/components/ui/ToastContainer'
import { useRequireAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoading, isAuthenticated } = useRequireAuth()
  const collapsed = useUIStore((state) => state.sidebarCollapsed)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={closeMobileNav} />
      <div className={`min-w-0 transition-all duration-300 ${collapsed ? 'md:pl-16' : 'md:pl-64'}`}>
        <Header onMobileMenu={() => setMobileNavOpen(true)} />
        <main className="min-w-0 overflow-x-clip p-4 pb-8 sm:p-6">{children}</main>
      </div>
      <ToastContainer />
    </div>
  )
}
