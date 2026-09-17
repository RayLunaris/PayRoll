'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Terjadi Kesalahan</h1>
        <p className="mt-4 text-gray-600">{error.message}</p>
        <button onClick={reset} className="btn btn-primary mt-6">
          Coba Lagi
        </button>
      </div>
    </div>
  )
}