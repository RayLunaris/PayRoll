'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const fetchMe = useAuthStore((state) => state.fetchMe)

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      fetchMe()
    }
  }, [isAuthenticated, isLoading, fetchMe])

  return { user, isAuthenticated, isLoading }
}

export function useRequireAuth() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  return { user, isAuthenticated, isLoading }
}

export function useRequireRole(...roles: string[]) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const rolesKey = roles.join(',')

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !rolesKey.split(',').includes(user.role)) {
      router.replace('/dashboard')
    }
  }, [user, isAuthenticated, isLoading, rolesKey, router])

  return { user, isAuthenticated, isLoading }
}