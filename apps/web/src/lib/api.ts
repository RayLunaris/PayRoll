import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { refreshServerSession } from '@/lib/session'
import { toast } from '@/stores/toast'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Never attempt a refresh for a request that opted out (e.g. the logout
    // call in stores/auth.ts, which is authenticated by the now-cleared store
    // token). Retrying it against /auth/refresh would re-enter logout() and
    // race the recursion.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !(originalRequest as { _skipAuthRefresh?: boolean })._skipAuthRefresh
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Single-flight, shared with the auth store's session restore: both the
        // axios 401 interceptor and fetchMe() refresh via the SAME in-flight
        // request so they can never rotate the refresh token twice in parallel
        // (the auth-service revokes the rotated token, turning the loser into a
        // 401 "Session refresh failed").
        const { accessToken, refreshToken } = await refreshServerSession()
        useAuthStore.getState().setTokens(accessToken, refreshToken)

        processQueue(null, accessToken)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        useAuthStore.getState().logout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    if (typeof window !== 'undefined' && error?.response) {
      const status = error.response.status
      const method = error.config?.method?.toUpperCase() || 'GET'
      const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
      const data = error.response.data
      const detailMsg = Array.isArray(data?.details)
        ? data.details.map((d: any) => d.message || `${d.path?.join('.')}: invalid`).join(', ')
        : (typeof data?.details === 'string' ? data.details : '')
      const errorMsg = detailMsg
        ? `${data?.error || 'Validasi gagal'}: ${detailMsg}`
        : (data?.error || data?.message)

      console.error(
        `[API Error ${status}] ${method} ${error.config?.url}:`,
        data
      )

      if (status === 403) {
        toast.error('Akses ditolak: Anda tidak memiliki izin untuk tindakan ini.')
      } else if (status === 429) {
        toast.warning('Terlalu banyak permintaan (Rate limit). Silakan tunggu sebentar.')
      } else if (isMutation && status >= 400 && status < 500 && errorMsg) {
        toast.error(errorMsg)
      } else if (isMutation && status >= 500) {
        toast.error('Terjadi kesalahan pada server. Silakan coba lagi nanti.')
      }
    }

    return Promise.reject(error)
  },
)

export default api