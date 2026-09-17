export const ACCESS_TOKEN_COOKIE = 'accessToken'
export const USER_ROLE_COOKIE = 'userRole'

export function setAuthCookies(accessToken: string, role?: string) {
  if (typeof document === 'undefined') return

  document.cookie = `${ACCESS_TOKEN_COOKIE}=${accessToken}; path=/; samesite=lax`
  if (role) {
    document.cookie = `${USER_ROLE_COOKIE}=${role}; path=/; samesite=lax`
  }
}

export function clearAuthCookies() {
  if (typeof document === 'undefined') return

  const expiry = 'expires=Thu, 01 Jan 1970 00:00:00 GMT'
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; ${expiry}; path=/`
  document.cookie = `${USER_ROLE_COOKIE}=; ${expiry}; path=/`
}