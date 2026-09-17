'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import api from '@/lib/api'

const registerSchema = z
  .object({
    email: z.string().email('Email tidak valid'),
    password: z.string().min(6, 'Password minimal 6 karakter'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password tidak sama',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true)
    setError('')
    try {
      // Backend locks role to 'employee' for self-registration (no role payload).
      await api.post('/auth/register', {
        email: data.email,
        password: data.password,
      })
      router.push('/login?registered=true')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Registrasi gagal. Coba lagi.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
        Daftar Akun
      </h2>

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

        <div>
          <label className="label">Password</label>
          <input
            type="password"
            {...register('password')}
            className="input"
            placeholder="Minimal 6 karakter"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label className="label">Konfirmasi Password</label>
          <input
            type="password"
            {...register('confirmPassword')}
            className="input"
            placeholder="Ulangi password"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Memproses...' : 'Daftar'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Sudah punya akun?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Masuk disini
        </Link>
      </div>
    </div>
  )
}