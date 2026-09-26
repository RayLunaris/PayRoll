import { create } from 'zustand'
import api from '@/lib/api'
import type { User } from '@/types'
import { clearServerSession, persistServerSession } from '@/lib/auth-cookie'
import { refreshServerSession } from '@/lib/session'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  hasHydrated: boolean
  restoreAttempted: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  setTokens: (accessToken: string, refreshToken: string) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  hasHydrated: true,
  restoreAttempted: false,

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
        restoreAttempted: true,
      })
      await persistServerSession(accessToken, refreshToken, user?.role)
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

    // Clear the local session FIRST, before any network call. The axios
    // response interceptor calls logout() again when a refresh fails, and
    // that recursion must see an already-empty store or it loops forever
    // (stale refresh cookie + expired access token => endless
    // 401 -> refresh -> logout -> 401 -> ...).
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
      isLoading: false,
      restoreAttempted: true,
    })

    if (accessToken && refreshToken) {
      try {
        // Send the captured access token explicitly (the store is already
        // cleared) and mark the request so the interceptor never retries with
        // /auth/refresh when this endpoint answers 401.
        await api.post('/auth/logout', { refreshToken }, {
          headers: { Authorization: `Bearer ${accessToken}` },
          _skipAuthRefresh: true,
        } as import('axios').AxiosRequestConfig)
      } catch {
        // Best-effort revoke: state is cleared regardless of server result.
      }
    }

    await clearServerSession()
  },

  fetchMe: async () => {
    // Set loading synchronously BEFORE the (possibly awaited) session-restore:
    // useRequireAuth()/useRequireRole() guards gate on `isLoading` and must not
    // fire their router.replace('/login') on the first paint while the HttpOnly
    // refresh-token restore is still rotating. Otherwise a hard reload of any
    // dashboard page races the guard redirect against fetchMe() and always
    // lands on /login despite a successful refresh + /auth/me 200.
    set({ isLoading: true })

    let { accessToken } = get()

    if (!accessToken) {
      if (get().restoreAttempted) {
        set({ isLoading: false })
        return
      }
      // Restore session from HttpOnly refresh-token cookie on hard reload.
      // Route through the SAME single-flight coordinator used by the axios
      // 401-interceptor (lib/session.ts) so fetchMe() and interceptor-triggered
      // refreshes can never rotate the refresh token twice in parallel — the
      // auth-service rotates+revokes on every /auth/refresh, leaving the loser
      // of a concurrent race with a revoked cookie and a 401 "Session refresh
      // failed" that breaks every dashboard fetch on cold page loads.
      let restored: { accessToken: string; refreshToken: string }
      try {
        restored = await refreshServerSession()
      } catch {
        set({ restoreAttempted: true, isLoading: false })
        await get().logout()
        return
      }
      set({
        accessToken: restored.accessToken,
        refreshToken: restored.refreshToken,
        isAuthenticated: true,
        restoreAttempted: true,
      })
      accessToken = restored.accessToken
    }

    set({ isLoading: true })
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data.data, isAuthenticated: true, isLoading: false, restoreAttempted: true })
    } catch (err: unknown) {
      set({ isLoading: false, restoreAttempted: true })
      const status = (err as { response?: { status?: number } })?.response?.status
      // Only logout when token is strictly unauthorized (401).
      // Do NOT logout on transient errors like 429 RateLimit, 500, or network failures.
      if (status === 401) {
        await get().logout()
      }
    }
  },

  setTokens: (accessToken: string, refreshToken: string) => {
    set({
      accessToken,
      refreshToken,
      isAuthenticated: true,
      restoreAttempted: true,
      isLoading: false,
    })
    void persistServerSession(accessToken, refreshToken, get().user?.role)
  },

  clearError: () => set({ error: null }),
}))