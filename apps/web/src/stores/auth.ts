import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/lib/api'
import type { User } from '@/types'
import { clearAuthCookies, setAuthCookies } from '@/lib/auth-cookie'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  hasHydrated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  setTokens: (accessToken: string, refreshToken: string) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          const { user, accessToken, refreshToken } = data.data
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
          setAuthCookies(accessToken, user?.role)
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Login failed'
          set({ error: message, isLoading: false })
          throw err
        }
      },

      logout: async () => {
        const { accessToken, refreshToken } = get()

        if (accessToken && refreshToken) {
          try {
            await api.post('/auth/logout', { refreshToken })
          } catch {
            // Best-effort revoke: state is cleared regardless of server result.
          }
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        })
        clearAuthCookies()
      },

      fetchMe: async () => {
        const { accessToken } = get()
        if (!accessToken) return

        set({ isLoading: true })
        try {
          const { data } = await api.get('/auth/me')
          set({ user: data.data, isAuthenticated: true, isLoading: false })
        } catch {
          set({ isLoading: false })
          get().logout()
        }
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken, isAuthenticated: true })
        setAuthCookies(accessToken, get().user?.role)
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'payrollpro-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AuthState>
        const hasTokens = Boolean(p.accessToken)
        return {
          ...current,
          ...p,
          isAuthenticated: hasTokens,
          hasHydrated: true,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          setAuthCookies(state.accessToken, state.user?.role)
        } else {
          clearAuthCookies()
        }
      },
    },
  ),
)