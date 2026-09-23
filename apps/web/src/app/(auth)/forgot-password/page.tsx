'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'

const forgotSchema = z.object({
  email: z.string().email('Format email tidak valid'),
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
      // Selalu tampilkan status sukses generik untuk keamanan (anti enumeration)
      setSent(true)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429) {
        setError('Terlalu banyak permintaan reset password. Silakan tunggu 15 menit.')
      } else {
        // Tampilkan pesan generik agar tidak membocorkan keberadaan email
        setSent(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <div className="mb-6 text-center">
        <div className="flex h-12 w-12 mx-auto mb-3 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <Mail className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Lupa Password</h2>
        <p className="mt-1 text-sm text-gray-600">
          Masukkan email akun Anda untuk menerima tautan reset password.
        </p>
      </div>

      {sent ? (
        <div className="space-y-5 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800 text-left flex items-start gap-3 border border-emerald-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Instruksi Terkirim</p>
              <p className="mt-1 text-emerald-700">
                Jika email terdaftar, link reset password sudah dikirim ke inbox Anda. Tautan berlaku selama <strong>30 menit</strong>.
              </p>
            </div>
          </div>
          <Link href="/login" className="btn btn-secondary w-full">
            Kembali ke Login
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email Akun</label>
              <input
                type="email"
                {...register('email')}
                className="input"
                placeholder="nama@perusahaan.com"
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Mengirim Instruksi...' : 'Kirim Instruksi Reset Password'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke login
            </Link>
          </div>
        </>
      )}
    </div>
  )
}