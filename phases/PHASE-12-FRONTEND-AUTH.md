# Phase 12: Frontend Auth

**Objective:** Implementasi halaman login, register, dan auth middleware  
**Estimated Time:** 6-8 hours  
**Prerequisites:** Phase 11 selesai

---

## Tasks

### 12.1 Create Auth Layout

```bash
# src/app/(auth)/layout.tsx
cat > src/app/(auth)/layout.tsx << 'EOF'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">PayrollPro</h1>
          <p className="text-blue-200">Sistem Manajemen Payroll Perusahaan</p>
        </div>
        {children}
        <div className="mt-8 text-center text-xs text-blue-300">
          © 2024 PayrollPro. All rights reserved.
        </div>
      </div>
    </div>
  )
}
EOF
```

### 12.2 Create Login Page

```bash
# src/app/(auth)/login/page.tsx
cat > src/app/(auth)/login/page.tsx << 'EOF'
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/stores/auth';

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        Masuk ke Akun Anda
      </h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
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
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600" />
            <span className="ml-2 text-sm text-gray-600">Ingat saya</span>
          </label>
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
            Lupa password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Memproses...
            </>
          ) : (
            'Masuk'
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Belum punya akun?{' '}
        <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
          Daftar disini
        </Link>
      </div>
    </div>
  );
}
EOF
```

### 12.3 Create Register Page

```bash
# src/app/(auth)/register/page.tsx
cat > src/app/(auth)/register/page.tsx << 'EOF'
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';

const registerSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password tidak sama',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError('');
    try {
      await api.post('/api/auth/register', {
        email: data.email,
        password: data.password,
        role: 'employee',
      });
      router.push('/login?registered=true');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        Daftar Akun
      </h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
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

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? 'Memproses...' : 'Daftar'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Sudah punya akun?{' '}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Masuk disini
        </Link>
      </div>
    </div>
  );
}
EOF
```

### 12.4 Create Auth Middleware (Route Protection)

```bash
# next.config.ts middleware (or src/middleware.ts)
cat > src/middleware.ts << 'EOF'
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes (no auth required)
const publicRoutes = ['/', '/login', '/register', '/forgot-password'];

// Admin only routes
const adminRoutes = ['/settings', '/reports'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if public route
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check token
  const token = request.cookies.get('accessToken')?.value;
  
  // For dashboard routes, redirect to login if no token
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // TODO: Add role check for admin routes
  // if (adminRoutes.some((route) => pathname.startsWith(route))) {
  //   const userRole = request.cookies.get('userRole')?.value;
  //   if (userRole !== 'super_admin' && userRole !== 'hr_admin') {
  //     return NextResponse.redirect(new URL('/dashboard', request.url));
  //   }
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
EOF
```

### 12.5 Create Auth Hook

```bash
# src/hooks/useAuth.ts
cat > src/hooks/useAuth.ts << 'EOF'
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';

export function useAuth() {
  const { user, isAuthenticated, isLoading, fetchMe } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      fetchMe();
    }
  }, [isAuthenticated, isLoading, fetchMe]);

  return { user, isAuthenticated, isLoading };
}

export function useRequireAuth() {
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isAuthenticated, isLoading]);

  return { user, isAuthenticated, isLoading };
}

export function useRequireRole(...roles: string[]) {
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (!roles.includes(user.role)) {
        window.location.href = '/dashboard';
      }
    }
  }, [user, isAuthenticated, isLoading, roles]);

  return { user, isAuthenticated, isLoading };
}
EOF
```

### 12.6 Create Forgot Password Page

```bash
# src/app/(auth)/forgot-password/page.tsx
cat > src/app/(auth)/forgot-password/page.tsx << 'EOF'
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const forgotSchema = z.object({
  email: z.string().email('Email tidak valid'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotForm) => {
    setLoading(true);
    // TODO: Call reset password API
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        Lupa Password
      </h2>

      {sent ? (
        <div className="text-center space-y-4">
          <div className="p-4 rounded-lg bg-emerald-50 text-emerald-700">
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
          <p className="text-sm text-gray-600 mb-6 text-center">
            Masukkan email Anda dan kami akan mengirimkan instruksi untuk reset password.
          </p>

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

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Mengirim...' : 'Kirim Instruksi Resert Password'}
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
  );
}
EOF
```

---

## Verification Checklist

- [ ] Login page berfungsi
- [ ] Register page berfungsi
- [ ] Forgot password page berfungsi
- [ ] Middleware melindungi routes
- [ ] Auth store menyimpan token
- [ ] Redirect ke login jika tidak authenticated
- [ ] Form validation bekerja
- [ ] Loading states ditampilkan
- [ ] Error handling bekerja
- [ ] Token refresh otomatis

---

## Next Phase

Setelah Phase 12 selesai, lanjut ke:
**[Phase 13: Frontend Layout](./PHASE-13-FRONTEND-LAYOUT.md)**