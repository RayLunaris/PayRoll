export const ACCESS_TOKEN_COOKIE = 'prp_access'
export const REFRESH_TOKEN_COOKIE = 'prp_refresh'
export const USER_ROLE_COOKIE = 'prp_role'

// Tokens are persisted in HttpOnly cookies via a same-origin route handler so
// JavaScript (and therefore XSS) can never read the raw refresh token.
export async function persistServerSession(
  accessToken: string,
  refreshToken: string,
  role?: string,
): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, refreshToken, role }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function clearServerSession(): Promise<void> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' })
  } catch {
    // Best-effort: in-memory state is cleared regardless.
  }
}