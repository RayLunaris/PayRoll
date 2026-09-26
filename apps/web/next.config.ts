import type { NextConfig } from 'next'

// API origin for /uploads proxying (Vercel frontend + separate API host).
// NEXT_PUBLIC_API_URL includes an `/api` suffix (gateway prefix).
const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const apiOrigin = apiBase.replace(/\/api\/?$/, '')

const isVercel = Boolean(process.env.VERCEL)

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Content-Security-Policy',
    value: `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https:${
      process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''
    }; connect-src 'self' wss: https: http: ws:; font-src 'self' data:;`,
  },
]

const nextConfig: NextConfig = {
  // Docker image uses standalone output; Vercel hosts natively and ignores it.
  ...(isVercel ? {} : { output: 'standalone' as const }),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  async rewrites() {
    return [
      {
        // Social/attendance files are served by social-service via the gateway;
        // browser on Vercel must not resolve relative /uploads against the frontend host.
        source: '/uploads/:path*',
        destination: `${apiOrigin}/uploads/:path*`,
      },
    ]
  },
}

export default nextConfig
