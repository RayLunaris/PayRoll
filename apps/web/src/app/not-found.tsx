import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-lg text-gray-600">Halaman tidak ditemukan</p>
        <Link href="/dashboard" className="btn btn-primary mt-6">
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  )
}