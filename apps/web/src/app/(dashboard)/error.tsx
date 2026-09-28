'use client'

import { useEffect } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error boundary caught:', error)
  }, [error])

  return (
    <div className="card my-8 mx-auto max-w-xl text-center py-10 px-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">Terjadi Kesalahan pada Halaman Ini</h2>
      <p className="mt-2 text-sm text-gray-600">
        {error.message || 'Halaman gagal dimuat. Silakan muat ulang komponen ini.'}
      </p>
      {error.digest && (
        <p className="mt-1 text-xs font-mono text-gray-400">
          ID Error: {error.digest}
        </p>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="btn btn-primary text-sm flex items-center gap-1.5"
        >
          <RotateCcw className="h-4 w-4" />
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
