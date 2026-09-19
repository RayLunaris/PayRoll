'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const restoreAttempted = useAuthStore((state) => state.restoreAttempted)
  const fetchMe = useAuthStore((state) => state.fetchMe)

  useEffect(() => {
    if (hasHydrated && !isAuthenticated && !isLoading && !restoreAttempted) {
      fetchMe()
    }
  }, [hasHydrated, isAuthenticated, isLoading, restoreAttempted, fetchMe])

  return { user, isAuthenticated, isLoading, hasHydrated }
}

export function useRequireAuth() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, hasHydrated } = useAuth()
  const restoreFinished = useAuthStore((state) => state.restoreAttempted)
  const loading = isLoading || !hasHydrated || !restoreFinished

  useEffect(() => {
    // Only redirect when session-restore has actually COMPLETED (restoreFinished).
    // On cold page loads fetchMe() restores from the HttpOnly refresh-token
    // cookie, which is async; if the guard fires its router.replace('/login') on
    // the very first commit — while isLoading is still false and the restore is
    // in flight — every dashboard page hard-lands on /login even though the
    // restore + /auth/me succeed a moment later (the E2E "Session refresh
    // failed / target page closed" class of flake).
    if (hasHydrated && restoreFinished && !isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [hasHydrated, isAuthenticated, isLoading, restoreFinished, router])

  return { user, isAuthenticated, isLoading: loading, hasHydrated }
}

export function useRequireRole(...roles: string[]) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, hasHydrated } = useAuth()
  const restoreFinished = useAuthStore((state) => state.restoreAttempted)
  const loading = isLoading || !hasHydrated || !restoreFinished
  const rolesKey = roles.join(',')

  useEffect(() => {
    if (hasHydrated && restoreFinished && !isLoading && !isAuthenticated) {
      router.replace('/login')
      return
    }
    if (hasHydrated && !isLoading && isAuthenticated && user && !rolesKey.split(',').includes(user.role)) {
      router.replace('/dashboard')
    }
  }, [user, isAuthenticated, isLoading, hasHydrated, restoreFinished, rolesKey, router])

  return { user, isAuthenticated, isLoading: loading }
}