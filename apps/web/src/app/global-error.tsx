'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50 font-sans">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900">Terjadi Kesalahan</h1>
            <p className="mt-4 text-gray-600">
              Aplikasi gagal dimuat. Silakan coba lagi.
            </p>
            <button onClick={reset} className="btn btn-primary mt-6">
              Coba Lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
