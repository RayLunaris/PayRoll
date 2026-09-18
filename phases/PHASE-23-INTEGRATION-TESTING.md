# Phase 23: Integrasi & Testing

**Objective:** Integrasi end-to-end antar service, testing, dan perbaikan bug  
**Estimated Time:** 10-14 hours  
**Prerequisites:** Phase 22 selesai

---

## Tasks

### 23.1 Install Testing Dependencies

```bash
# Root workspace
pnpm add -D vitest @vitest/coverage-v8 --filter @payrollpro/shared
pnpm add -D vitest supertest @types/supertest --filter @payrollpro/*-service

# Frontend
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
pnpm add -D @playwright/test --filter @payrollpro/web

# E2E browser
pnpm dlx playwright install chromium
```

### 23.2 Write Backend Unit Tests

```bash
# packages/shared/src/utils/haversine.test.ts
cat > packages/shared/src/utils/haversine.test.ts << 'EOF'
import { describe, expect, it } from 'vitest';
import { calculateDistance } from './haversine';

describe('calculateDistance', () => {
  const jakarta = { lat: -6.2088, lng: 106.8456 };
  const bandung = { lat: -6.9175, lng: 107.6191 };

  it('should calculate correct distance between Jakarta and Bandung', () => {
    const distance = calculateDistance(jakarta.lat, jakarta.lng, bandung.lat, bandung.lng);
    // Actual straight-line distance is ~116 km
    expect(distance).toBeGreaterThan(100000);
    expect(distance).toBeLessThan(130000);
  });

  it('should return 0 for same coordinate', () => {
    const distance = calculateDistance(jakarta.lat, jakarta.lng, jakarta.lat, jakarta.lng);
    expect(distance).toBe(0);
  });

  it('should handle small distances correctly (100m radius check)', () => {
    // ~55 meters east of Jakarta coordinates
    const nearby = { lat: -6.2088, lng: 106.8461 };
    const distance = calculateDistance(jakarta.lat, jakarta.lng, nearby.lat, nearby.lng);
    expect(distance).toBeLessThan(100);
  });
});
EOF
```

```bash
# packages/shared/src/utils/payroll.test.ts
cat > packages/shared/src/utils/payroll.test.ts << 'EOF'
import { describe, expect, it } from 'vitest';
import {
  calculateOvertimePay,
  calculatePPh21,
  calculateBPJSDeductions,
  calculateNetSalary,
} from './payroll';

describe('calculateOvertimePay', () => {
  it('should calculate overtime pay with hourly rate = salary / 173', () => {
    const salary = 5000000;
    const hourlyRate = salary / 173; // ~28,901
    const overtimeHours = 2;
    const rate = 1.5;

    const pay = calculateOvertimePay(hourlyRate, overtimeHours, rate);
    expect(pay).toBeCloseTo(86703, 0);
  });
});

describe('calculatePPh21', () => {
  it('should return 0 if annual income is below PTKP', () => {
    const annualNetIncome = 50000000; // below 54jt PTKP
    const ptkp = 54000000;
    expect(calculatePPh21(annualNetIncome, ptkp)).toBe(0);
  });

  it('should apply progressive rates correctly', () => {
    // Annual income 120jt - PTKP 54jt = 66jt taxable
    const annualNetIncome = 120000000;
    const ptkp = 54000000;
    
    const tax = calculatePPh21(annualNetIncome, ptkp);
    // 60jt * 5% + 6jt * 15% = 3jt + 900rb = 3.9jt
    expect(tax).toBeCloseTo(3900000, 0);
  });
});

describe('calculateBPJSDeductions', () => {
  it('should calculate JKN employee deduction correctly', () => {
    const salary = 5000000;
    const jknRate = 1; // 1% employee

    const deduction = calculateBPJSDeductions(salary, { jknEmployee: jknRate });
    expect(deduction.jkn).toBe(50000);
  });
});

describe('calculateNetSalary', () => {
  it('should subtract deductions and add overtime', () => {
    const baseSalary = 5000000;
    const additions = { overtime: 100000 };
    const deductions = { jkn: 50000, jht: 100000, tax: 88000 };

    const net = calculateNetSalary(baseSalary, additions, deductions);
    expect(net).toBe(4862000);
  });
});
EOF

# Install jest environment for node
pnpm exec vitest run --config packages/shared/vitest.config.ts
```

### 23.3 Write Service Integration Tests

```bash
# apps/auth-service/src/__tests__/auth.test.ts
cat > apps/auth-service/src/__tests__/auth.test.ts << 'EOF'
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app';
import { db } from '../db';

let app: any;

beforeAll(async () => {
  app = await buildApp();
  await db.execute('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await app.close();
});

describe('Auth API', () => {
  const testUser = {
    email: 'test@payroll.com',
    password: 'password123',
    fullName: 'Test User',
    role: 'employee',
  };

  it('should register a new user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.email).toBe(testUser.email);
  });

  it('should reject duplicate registration', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser,
    });

    expect(response.statusCode).toBe(409);
  });

  it('should login and return JWT tokens', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: testUser.password },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveProperty('accessToken');
    expect(body.data).toHaveProperty('refreshToken');
    expect(body.data.user.role).toBe('employee');
  });

  it('should reject wrong password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: 'wrongpass' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get current user with valid token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: testUser.password },
    });
    const { accessToken } = login.json().data;

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.email).toBe(testUser.email);
  });
});
EOF

pnpm exec vitest run --config apps/auth-service/vitest.config.ts
```

### 23.4 Write Cache/Redis Integration

```bash
# apps/auth-service/src/plugins/redis.test.ts
cat > apps/auth-service/src/plugins/redis.test.ts << 'EOF'
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createClient } from 'redis';

describe('Redis Integration', () => {
  const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.quit();
  });

  it('should set and get a value', async () => {
    await client.set('test-key', 'test-value');
    const value = await client.get('test-key');
    expect(value).toBe('test-value');
  });

  it('should expire keys with TTL', async () => {
    await client.set('temp-key', 'temp', { EX: 1 });
    const immediate = await client.get('temp-key');
    expect(immediate).toBe('temp');

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const expired = await client.get('temp-key');
    expect(expired).toBeNull();
  });
});
EOF
```

### 23.5 Write Frontend Tests (Vitest + Testing Library)

```bash
# src/lib/api.test.ts
cat > src/__tests__/api.test.ts << 'EOF'
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock axios
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }),
  },
}));

import api from '@/lib/api';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes GET method', () => {
    expect(typeof api.get).toBe('function');
  });

  it('exposes POST method', () => {
    expect(typeof api.post).toBe('function');
  });

  it('exposes PUT method', () => {
    expect(typeof api.put).toBe('function');
  });

  it('exposes DELETE method', () => {
    expect(typeof api.delete).toBe('function');
  });
});
EOF
```

```bash
# src/stores/auth.test.ts
cat > src/__tests__/auth-store.test.ts << 'EOF'
import { describe, expect, it, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth';

describe('Auth Store', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  });

  it('should initialize as unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set user on login', () => {
    const user = { id: '1', email: 'test@payroll.com', role: 'employee' };
    const token = 'jwt-token';
    
    useAuthStore.getState().setAuth(user, token);
    
    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.token).toBe(token);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should clear user on logout', () => {
    const user = { id: '1', email: 'test@payroll.com', role: 'employee' };
    useAuthStore.getState().setAuth(user, 'jwt-token');
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
EOF
```

### 23.6 Write E2E Tests (Playwright)

```bash
# e2e/auth.spec.ts
cat > e2e/auth.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

test.describe('Authentication Flow', () => {
  test('should display login form', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText(/Masuk/);
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'wrong@payroll.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.text-red-600, .bg-red-50')).toBeVisible({ timeout: 5000 });
  });

  test('should allow login with admin credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@payrollpro.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await expect(page.locator('text=Dashboard')).toBeAttached();
  });
});
EOF
```

```bash
# e2e/employee-crud.spec.ts
cat > e2e/employee-crud.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

test.describe('Employee Management (HR)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'admin@payrollpro.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should create employee', async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);

    await page.click('text=Tambah Karyawan');
    await page.fill('input[name="nip"]', 'EMP-TEST-001');
    await page.fill('input[name="fullName"]', 'Test Employee');
    await page.selectOption('select[name="departmentId"]', { index: 1 });
    await page.fill('input[name="baseSalary"]', '5000000');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=EMP-TEST-001')).toBeVisible({ timeout: 10000 });
  });

  test('should search employee', async ({ page }) => {
    await page.goto(`${BASE_URL}/employees`);
    await page.fill('input[placeholder*="Cari"]', 'EMP-TEST-001');
    await expect(page.locator('text=EMP-TEST-001')).toBeVisible();
  });
});
EOF
```

```bash
# e2e/attendance.spec.ts
cat > e2e/attendance.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

test.describe('Attendance Flow', () => {
  test('should show check-in button and clock-in', async ({ page }) => {
    // Login as employee
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'employee@payrollpro.com');
    await page.fill('input[type="password"]', 'employee123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

    // Go to attendance
    await page.goto(`${BASE_URL}/attendance`);
    await expect(page.locator('text=Clock In atau check-in')).toBeVisible({ timeout: 10000 });

    // Click check-in (mocked: coordinates inside radius)
    await page.click('text=Clock In');
    await expect(page.locator('text=Berhasil')).toBeVisible({ timeout: 10000 });
  });
});
EOF
```

### 23.7 Create Docker Compose for Testing & Run All Tests

```bash
# Root: run entire stack locally
docker-compose up -d

# Wait for DB readiness
sleep 10

# Run shared unit tests
pnpm --filter @payrollpro/shared test

# Run all service tests
pnpm --filter ./apps/*-service exec vitest run

# Run frontend unit tests
pnpm --filter @payrollpro/web exec vitest run

# Run E2E tests
pnpm --filter @payrollpro/web exec playwright test
```

### 23.8 Load & Performance Smoke Test

```bash
# Simple load test with autocannon
npx autocannon -c 20 -d 10 http://localhost:3001/api/auth/login
# Expectation: no 5xx errors, latency < 500ms p95

# Endpoint latency check for dashboard
npx autocannon -c 10 -d 5 http://localhost:3001/api/dashboard/stats
```

### 23.9 Bug Fixing & Polish Checklist

```bash
# Ensure all TypeScript compiles without errors across workspace
pnpm -r exec tsc --noEmit
```

Checklist perbaikan umum:

1. **Loading states** - pastikan semua tombol submit punya loading state agar tidak double-click.
2. **Empty states** - semua daftar kosong menampilkan pesan & ikon yang sesuai.
3. **Error states** - semua mutation API menampilkan pesan error yang jelas, bukan console error.
4. **Form validation** - field required, format email, panjang minimal password.
5. **Pagination** - daftar panjang (>50 rows) harus di-paginate.
6. **Timezones** - pastikan waktu disimpan dalam UTC dan ditampilkan lokal.
7. **Currency formatting** - gunakan `formatNumber` helper di semua tempat (id-ID).
8. **RBAC** - pastikan menu yang tidak berhak tidak tampil di sidebar.
9. **Accessibility** - label semua input, `alt` text semua gambar, kontras warna.
10. **Responsive** - tes pada viewport mobile 375px dan tablet 768px.

---

## Verification Checklist

- [x] Unit test haversine & payroll lulus — `gps.test.ts` 9/9, `payslip.test.ts` 4/4
- [x] Integration test auth service lulus — `auth.test.ts` 10/10
- [x] Redis integration test lulus — `redis.test.ts` 2/2 (ioredis)
- [x] Frontend store & api tests lulus — `auth-store` 5, `api` 3
- [x] E2E login flow lulus
- [x] E2E employee CRUD lulus
- [x] E2E attendance lulus
- [x] All TypeScript noEmit lulus — `pnpm -r exec tsc --noEmit` bersih
- [x] Load test tanpa 5xx errors — health 15k req, 100% 200, p95 35ms; login rate-limited 429 (didokumentasikan)
- [x] Database terpopulasi via seed — dev + `payrollpro_test`; 0 data uji tersisa

---

## Hasil & Temuan (dicatat saat pelaksanaan / Rule 12)

### Ringkasan hasil
| Item | Hasil |
|---|---|
| Unit test (hapus haversine & payslip) | 9 + 4 = 13 lulus |
| Integration test auth (termasuk Redis) | 12 lulus |
| Integration test payroll | 5 lulus |
| Frontend unit (auth-store & api client) | 8 lulus |
| E2E Playwright (login, employee CRUD, attendance check-in) | 6/6 lulus |
| Load test `/auth/login` (c20, 5s) | p95 23ms saat loop; 429 setelah kuota IP (rate-limit) — bukan 5xx |
| Load test `/health` (c50, 5s) | 15.382 req, 0 error, 100% 200, p95 ≤ 35ms |
| `pnpm -r exec tsc --noEmit` | bersih (semua paket) |
| Build `@payrollpro/web` | sukses |
| Sisa data uji di DB | 0 (dev & `payrollpro_test`) |

### Temuan kritis yang DIPERBAIKI
1. **Race condition hydration auth (kritis)** — `useRequireAuth` men-trigger `router.replace('/login')` sebelum zustand `persist` selesai rehydrate → hard navigation ke halaman lindungi (termasuk `refresh`) secara acak mengeluarkan user ke login (menu/halaman hilang). Perbaikan: flag `hasHydrated` + `merge` persist yang membuat `isAuthenticated`/`hasHydrated` deterministik sejak render pertama; hooks `useAuth`/`useRequireAuth`/`useRequireRole` digate `hasHydrated`. File: `apps/web/src/stores/auth.ts`, `apps/web/src/hooks/useAuth.ts`.
2. **Rate-limit global gateway mencemari `/health` (kritis operasional)** — `@fastify/rate-limit` global (max 100/min/IP) berlaku juga untuk `/health`, `/healthcheck`, `/docs`, `/`. Burst di satu endpoint (mis. login) membuat health check ikut 429 → monitoring keliru menganggap gateway down. Perbaikan: `allowList` untuk `/`, `/health`, `/healthcheck`, `/docs`. File: `apps/api-gateway/src/plugins/rate-limit.ts`.
3. **Fetch gagal dirender sebagai "belum ada data" (sistemik)** — gagal, lalu tabel "Belum ada..." membuat HR bisa ekspor CSV kosong yang terlihat valid. Perbaikan: banner error + gate empty-state untuk 11 halaman: `reports/{payroll,overtime,attendance,employee}`, `employees` (list + `[id]` detail yang tadinya render `null` blank), `leave/history`, `attendance/history`, `payroll/cash-advances`, `settings/{users,departments,locations}` + indikator loading.

### Temuan yang dicatat namun TIDAK diperbaiki (di luar batch kritis / butuh backend)
- **Dashboard menampilkan data placeholder sebagai nyata** — `AttendanceChart`, `PayrollChart`, `RecentActivity` memakai `MOCK_DATA` (TODO), stat "Hadir Hari Ini"/"Cuti Berjalan" hardcoded (0/1). Perlu endpoint agregat backend (dashboard stats) — diserahkan ke fase berikutnya, jangan diperbaiki asal agar tidak menyesatkan.
- **`MapView` "Map container is already initialized"** — unhandledRejection saat komponen re-render; overlay dev Next menampilkannya, tidak memblok fungsi.
- **`DELETE /auth/users/:id` mengembalikan 500 bila karyawan masih menautkan user** (FK) — alih-alih 400 yang informatif. Tidak menghambat alur E2E (hapus karyawan dulu, baru user).
- **`Failed to fetch quota` 401 pada dashboard untuk role admin** — kuota cuti di-fetch untuk semua role; request 401 ditangkap diam-diam.

### Dokumen fasa 23 yang DIPERBAIKI saat perencanaan (ketidakcocokan dengan kode nyata)
- `@payrollpro/shared` tidak ada → target test haversine dipindah ke `apps/attendance-service/src/services/gps.ts`.
- `/api/auth/register` ADA (dipakai integration test), `PORT=3002` bukan.
- Pencarian employee hanya `ilike(fullName)` (bukan NIP), rate limit login 10/min/IP, BASE_URL gateway = `http://localhost:3001/api`.
- `/api/dashboard/stats` tidak ada → load test ditarik ke `/health` gateway + `/auth/login`.

### Cara menjalankan
```bash
docker exec payrollpro-postgres psql -U postgres -d postgres -c "CREATE DATABASE payrollpro_test;"
pnpm db:migrate:test && pnpm db:seed:test        # (lihat konfigurasi vitest.env di tiap service)
pnpm test:unit                                     # unit + integration (4 paket)
pnpm test:e2e                                      # E2E Penuh (stack dev harus berjalan)
```

---

## Next Phase

Setelah Phase 23 selesai, lanjut ke:
**[Phase 24: Production Deployment](./PHASE-24-PRODUCTION.md)**