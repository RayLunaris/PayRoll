# Phase 11: Frontend Setup

**Objective:** Setup Next.js, Tailwind CSS, Zustand, dan struktur frontend  
**Estimated Time:** 4-6 hours  
**Prerequisites:** Phase 10 selesai

---

## Tasks

### 11.1 Initialize Next.js Project

```bash
# Create Next.js app di apps/web
cd apps

# Create Next.js project
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Options:
# - Would you like to use Turbopack? Yes
# - TypeScript: Yes
# - ESLint: Yes
# - Tailwind CSS: Yes
# - src/ directory: Yes
# - App Router: Yes
# - Import alias: @/*
```

### 11.2 Install Dependencies

```bash
cd web

# Install additional packages
pnpm add zustand           # State management
pnpm add axios              # HTTP client
pnpm add react-hook-form    # Form handling
pnpm add @hookform/resolvers # Zod resolvers
pnpm add zod                # Validation
pnpm add lucide-react       # Icons
pnpm add recharts           # Charts
pnpm add leaflet            # Maps untuk GPS
pnpm add @types/leaflet     # Leaflet types
```

### 11.3 Configure Environment Variables

```bash
# .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3002
NEXT_PUBLIC_APP_NAME=PayrollPro
NEXT_PUBLIC_GOOGLE_MAPS_DISABLED=true
EOF
```

### 11.4 Update Tailwind Configuration

```bash
# tailwind.config.ts
cat > tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
export default config
EOF
```

### 11.5 Create Folder Structure

```bash
# Create directories
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/components/attendance
mkdir -p src/components/leave
mkdir -p src/components/payroll
mkdir -p src/components/employee
mkdir -p src/components/social
mkdir -p src/components/shift
mkdir -p src/lib
mkdir -p src/stores
mkdir -p src/hooks
mkdir -p src/types
mkdir -p src/app/(auth)
mkdir -p src/app/(dashboard)
mkdir -p src/app/api
```

### 11.6 Create API Helper

```bash
# src/lib/api.ts
cat > src/lib/api.ts << 'EOF'
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - add token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If unauthorized and not retried yet
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
          { refreshToken }
        );
        
        localStorage.setItem('accessToken', response.data.data.accessToken);
        
        originalRequest.headers.Authorization = `Bearer ${response.data.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
EOF
```

### 11.7 Create Type Definitions

```bash
# src/types/index.ts
cat > src/types/index.ts << 'EOF'
export interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'hr_admin' | 'manager' | 'employee';
  isActive: boolean;
}

export interface Employee {
  id: string;
  nip: string;
  fullName: string;
  departmentId: string;
  positionId: string;
  locationId: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  joinDate: string;
  baseSalary: number;
  npwp?: string;
  bankName?: string;
  bankAccount?: string;
  photoUrl?: string;
  isActive: boolean;
}

export interface Attendance {
  id: string;
  employeeId: string;
  locationId: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: 'present' | 'late' | 'absent' | 'half_day' | 'leave';
  overtimeHours: number;
}

export interface Leave {
  id: string;
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'maternity' | 'paternity' | 'special' | 'unpaid';
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface LeaveQuota {
  leaveType: string;
  totalQuota: number;
  usedQuota: number;
  remaining: number;
}

export interface Payroll {
  id: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  baseSalary: number;
  overtimePay: number;
  allowances: number;
  bpjsEmployee: number;
  bpjsEmployer: number;
  taxDeduction: number;
  cashAdvance: number;
  netSalary: number;
  status: 'draft' | 'processed' | 'paid';
}

export interface SocialPost {
  id: string;
  userId: string;
  content: string;
  attachmentUrl?: string;
  postType: 'feed' | 'forum' | 'poll';
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'urgent';
  publishedAt: string;
}

export interface WorkLocation {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface CashAdvance {
  id: string;
  employeeId: string;
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deducted';
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
EOF
```

### 11.8 Create Zustand Auth Store

```bash
# src/stores/auth.ts
cat > src/stores/auth.ts << 'EOF'
import { create } from 'zustand';
import api from '@/lib/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/login', { email, password });
      
      const { user, accessToken, refreshToken } = response.data.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // Ignore logout errors
    }
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const response = await api.get('/api/auth/me');
      set({ user: response.data.data, isAuthenticated: true });
    } catch (error) {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
EOF
```

### 11.9 Update Root Layout

```bash
# src/app/layout.tsx
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PayrollPro',
  description: 'Sistem Web Payroll',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
EOF
```

### 11.10 Create Global Styles

```bash
# src/app/globals.css
cat > src/app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
  }
  
  * {
    @apply border-border;
  }
  
  body {
    @apply bg-gray-50 text-slate-900 antialiased;
  }
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
  }
  
  .btn-primary {
    @apply bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500;
  }
  
  .btn-secondary {
    @apply bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500;
  }
  
  .btn-danger {
    @apply bg-red-600 text-white hover:bg-red-700 focus:ring-red-500;
  }
  
  .btn-success {
    @apply bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500;
  }
  
  .input {
    @apply block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500;
  }
  
  .label {
    @apply block text-sm font-medium text-gray-700 mb-1;
  }
  
  .card {
    @apply bg-white rounded-xl shadow-card p-6;
  }
  
  .table-container {
    @apply overflow-x-auto rounded-lg border border-gray-200;
  }
  
  .table {
    @apply min-w-full divide-y divide-gray-200;
  }
  
  .table thead {
    @apply bg-gray-50;
  }
  
  .table th {
    @apply px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider;
  }
  
  .table td {
    @apply px-4 py-3 text-sm text-gray-900 whitespace-nowrap;
  }
  
  .table tbody tr {
    @apply hover:bg-gray-50 transition-colors;
  }
  
  .badge {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
  }
  
  .badge-green {
    @apply bg-emerald-100 text-emerald-800;
  }
  
  .badge-red {
    @apply bg-red-100 text-red-800;
  }
  
  .badge-yellow {
    @apply bg-yellow-100 text-yellow-800;
  }
  
  .badge-blue {
    @apply bg-blue-100 text-blue-800;
  }
  
  .badge-gray {
    @apply bg-gray-100 text-gray-800;
  }
}
EOF
```

### 11.11 Create re-export statement for next.config

```bash
# next.config.ts (already created by create-next-app)
# Update untuk standalone output (Docker)
cat > next.config.ts << 'EOF'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost'],
  },
}

export default nextConfig
EOF
```

### 11.12 Create Dockerfile

```bash
# Dockerfile
cat > Dockerfile << 'EOF'
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
EOF
```

---

## Verification Checklist

- [ ] Next.js project created
- [ ] Tailwind CSS configured
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Folder structure created
- [ ] API helper created
- [ ] Types created
- [ ] Auth store created
- [ ] Root layout updated
- [ ] Global styles added

---

## Frontend Structure

```
web/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login, Register
│   │   ├── (dashboard)/      # Protected pages
│   │   │   ├── attendance/
│   │   │   ├── leave/
│   │   │   ├── payroll/
│   │   │   ├── employees/
│   │   │   ├── social/
│   │   │   ├── shift/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/               # Reusable components
│   │   ├── layout/           # Sidebar, Header
│   │   └── ...               # Feature components
│   ├── lib/
│   │   └── api.ts            # Axios instance
│   ├── stores/
│   │   └── auth.ts          # Zustand store
│   ├── hooks/
│   └── types/
```

---

## Next Phase

Setelah Phase 11 selesai, lanjut ke:
**[Phase 12: Frontend Auth](./PHASE-12-FRONTEND-AUTH.md)**