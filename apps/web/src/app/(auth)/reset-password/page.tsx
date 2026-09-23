'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import api from '@/lib/api'

const resetSchema = z
  .object({
    newPassword: z.string().min(6, 'Password minimal 6 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  })

type ResetForm = z.infer<typeof resetSchema>

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  })

  if (!token) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-xl text-center space-y-4">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Token Tidak Ditemukan</h2>
        <p className="text-sm text-gray-600">
          Tautan reset password tidak valid atau tidak memiliki token verifikasi. Silakan minta tautan baru melalui halaman lupa password.
        </p>
        <Link href="/forgot-password" className="btn btn-primary w-full">
          Minta Link Baru
        </Link>
      </div>
    )
  }

  const onSubmit = async (data: ResetForm) => {
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword,
      })
      setSuccess(true)
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
      const msg =
        resp?.error ||
        resp?.message ||
        'Gagal mereset password. Token mungkin sudah kedaluwarsa atau tidak valid.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Password Berhasil Direset!</h2>
          <p className="mt-2 text-sm text-gray-600">
            Kata sandi akun Anda telah diperbarui. Silakan login kembali menggunakan password baru Anda.
          </p>
        </div>
        <Link href="/login" className="btn btn-primary w-full">
          Masuk ke Akun
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <div className="mb-6 text-center">
        <div className="flex h-12 w-12 mx-auto mb-3 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Buat Password Baru</h2>
        <p className="mt-1 text-sm text-gray-600">
          Masukkan kata sandi baru untuk akun Anda.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Password Baru</label>
          <input
            type="password"
            {...register('newPassword')}
            className="input"
            placeholder="Minimal 6 karakter"
            autoComplete="new-password"
          />
          {errors.newPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
          )}
        </div>

        <div>
          <label className="label">Konfirmasi Password Baru</label>
          <input
            type="password"
            {...register('confirmPassword')}
            className="input"
            placeholder="Ulangi password baru"
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Menyimpan Password...' : 'Reset Password'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke login
        </Link>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Memuat formulir...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
