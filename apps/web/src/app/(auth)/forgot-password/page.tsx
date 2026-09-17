'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import api from '@/lib/api'

const forgotSchema = z.object({
  email: z.string().email('Email tidak valid'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotForm) => {
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email: data.email })
      setSent(true)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(
        status === 404
          ? 'Fitur reset password belum tersedia. Hubungi admin.'
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
              'Gagal mengirim instruksi. Coba lagi.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
        Lupa Password
      </h2>

      {sent ? (
        <div className="space-y-4 text-center">
          <div className="rounded-lg bg-emerald-50 p-4 text-emerald-700">
            <p className="font-medium">Email terkirim!</p>
            <p className="mt-1 text-sm">
              Periksa email Anda untuk instruksi reset password.
            </p>
          </div>
          <Link href="/login" className="btn btn-secondary">
            Kembali ke Login
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-6 text-center text-sm text-gray-600">
            Masukkan email Anda dan kami akan mengirimkan instruksi untuk reset password.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                {...register('email')}
                className="input"
                placeholder="nama@perusahaan.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Mengirim...' : 'Kirim Instruksi Reset Password'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <Link href="/login" className="text-blue-600 hover:text-blue-700">
              Kembali ke login
            </Link>
          </div>
        </>
      )}
    </div>
  )
}