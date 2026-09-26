'use client'

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

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className={`transition-all duration-300 ${collapsed ? 'pl-16' : 'pl-64'}`}>
        <Header />
        <main className="p-6">{children}</main>
      </div>
      <ToastContainer />
    </div>
  )
}