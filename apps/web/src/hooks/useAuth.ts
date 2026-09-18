'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const fetchMe = useAuthStore((state) => state.fetchMe)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !isLoading) {
      fetchMe()
    }
  }, [hasHydrated, isAuthenticated, isLoading, fetchMe])

  return { user, isAuthenticated, isLoading, hasHydrated }
}

export function useRequireAuth() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, hasHydrated } = useAuth()
  const loading = isLoading || !hasHydrated

  useEffect(() => {
    if (hasHydrated && !isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [hasHydrated, isAuthenticated, isLoading, router])

  return { user, isAuthenticated, isLoading: loading, hasHydrated }
}

export function useRequireRole(...roles: string[]) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, hasHydrated } = useAuth()
  const loading = isLoading || !hasHydrated
  const rolesKey = roles.join(',')

  useEffect(() => {
    if (hasHydrated && !isLoading && isAuthenticated && user && !rolesKey.split(',').includes(user.role)) {
      router.replace('/dashboard')
    }
  }, [user, isAuthenticated, isLoading, hasHydrated, rolesKey, router])

  return { user, isAuthenticated, isLoading: loading }
}