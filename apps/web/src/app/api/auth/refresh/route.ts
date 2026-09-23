import { NextResponse, type NextRequest } from 'next/server'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_ROLE_COOKIE } from '@/lib/auth-cookie'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Only mark the cookie Secure when the request arrived over HTTPS; the app is
// commonly served over plain HTTP (LAN/local), where browsers reject cookies
// with the Secure flag set.
const isSecureRequest = (request: Request): boolean => {
  try {
    const forwarded = request.headers.get('x-forwarded-proto')
    if ((forwarded || '').split(',')[0].trim() === 'https') return true
    return new URL(request.url).protocol === 'https:'
  } catch {
    return false
  }
}

const cookieOptions = (
  request: Request,
): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
} => ({
  httpOnly: true,
  secure: isSecureRequest(request),
  sameSite: 'lax',
  path: '/',
})

const clearSessionCookies = (res: NextResponse, request: Request) => {
  const opts = cookieOptions(request)
  res.cookies.set(ACCESS_TOKEN_COOKIE, '', { ...opts, maxAge: 0 })
  res.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...opts, maxAge: 0 })
  res.cookies.set(USER_ROLE_COOKIE, '', { ...opts, maxAge: 0 })
}

// Server-side refresh: reads the HttpOnly refresh token cookie, exchanges it
// with the gateway, then re-issues HttpOnly cookies and returns the new tokens
// so the client can keep the access token in memory only.
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  if (!refreshToken) {
    const res = NextResponse.json({ success: false, error: 'Session expired' }, { status: 401 })
    clearSessionCookies(res, request)
    return res
  }

  let upstream: Response
  try {
    upstream = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Auth service unavailable' }, { status: 502 })
  }

  let payload: unknown
  try {
    payload = await upstream.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid upstream response' }, { status: 502 })
  }
  if (!upstream.ok) {
    const res = NextResponse.json(payload, { status: upstream.status })
    if (upstream.status === 401 || upstream.status === 403) {
      clearSessionCookies(res, request)
    }
    return res
  }

  const body = payload as { data?: { accessToken?: string; refreshToken?: string } }
  const accessToken: string | undefined = body?.data?.accessToken
  const newRefreshToken: string | undefined = body?.data?.refreshToken
  if (!accessToken || !newRefreshToken) {
    return NextResponse.json({ success: false, error: 'Invalid refresh response' }, { status: 502 })
  }

  const res = NextResponse.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } })
  res.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, { ...cookieOptions(request), maxAge: 7 * 24 * 3600 })
  return res
}