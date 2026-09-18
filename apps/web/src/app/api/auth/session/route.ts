import { NextResponse } from 'next/server'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_ROLE_COOKIE } from '@/lib/auth-cookie'

// The app is commonly served over plain HTTP (LAN/local) where Secure cookies
// are silently refused by browsers. Only mark cookies Secure when the request
// actually arrived over HTTPS (direct or behind a proxy that sets the header).
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

export async function POST(request: Request) {
  let body: { accessToken?: string; refreshToken?: string; role?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.accessToken || !body.refreshToken) {
    return NextResponse.json({ success: false, error: 'Access and refresh tokens are required' }, { status: 400 })
  }

  const opts = cookieOptions(request)
  const res = NextResponse.json({ success: true })
  res.cookies.set(ACCESS_TOKEN_COOKIE, body.accessToken, { ...opts, maxAge: 15 * 60 })
  res.cookies.set(REFRESH_TOKEN_COOKIE, body.refreshToken, { ...opts, maxAge: 7 * 24 * 3600 })
  if (body.role) {
    res.cookies.set(USER_ROLE_COOKIE, body.role, { ...opts, maxAge: 7 * 24 * 3600 })
  }
  return res
}

export async function DELETE(request: Request) {
  const opts = cookieOptions(request)
  const res = NextResponse.json({ success: true })
  res.cookies.set(ACCESS_TOKEN_COOKIE, '', { ...opts, maxAge: 0 })
  res.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...opts, maxAge: 0 })
  res.cookies.set(USER_ROLE_COOKIE, '', { ...opts, maxAge: 0 })
  return res
}