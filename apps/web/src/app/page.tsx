import { redirect } from 'next/navigation'

// Safety-net fallback: the proxy handles '/' redirect before rendering,
// so this page is never reached in normal flow. If the proxy is bypassed
// (e.g. static export), redirect unauthenticated users to login.
export default function Home() {
  redirect('/login')
}