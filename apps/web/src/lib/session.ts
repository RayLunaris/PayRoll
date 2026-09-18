// Single-flight refresh coordinator.
//
// The auth-service rotates refresh tokens on every /auth/refresh (old token is
// revoked and replaced). If two code paths refresh with the SAME refresh-token
// cookie at the same moment (e.g. fetchMe() session-restore and the axios
// 401-interceptor firing together during a full page load), both requests carry
// the same pre-rotation cookie; the first call rotates+revokes it and the
// second one fails with "Session refresh failed", which breaks every dashboard
// fetch on that page.
//
// We funnel every refresh through this module so only ONE /api/auth/refresh
// request is ever in flight; concurrent callers await the same promise and all
// receive the same (already-rotated) tokens without re-using the old cookie.

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null

export function refreshServerSession(): Promise<{ accessToken: string; refreshToken: string }> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch('/api/auth/refresh', { method: 'POST' })
      if (!res.ok) {
        throw new Error('Session refresh failed')
      }
      const json = await res.json()
      if (!json?.data?.accessToken || !json?.data?.refreshToken) {
        throw new Error('Invalid refresh response')
      }
      return {
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken,
      }
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}
