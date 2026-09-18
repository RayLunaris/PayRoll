import type { APIRequestContext, Page } from '@playwright/test';

export const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const ADMIN_EMAIL = 'admin@payrollpro.com';
const ADMIN_PASSWORD = 'admin123';

let cachedAdminToken: string | null = null;

function tokenHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getAdminToken(request: APIRequestContext): Promise<string> {
  if (cachedAdminToken) return cachedAdminToken;

  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Admin API login failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  cachedAdminToken = body.data.accessToken as string;
  return cachedAdminToken;
}

export async function loginViaUi(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

export async function fetchRefs(request: APIRequestContext, token: string) {
  const [deptRes, posRes, locRes] = await Promise.all([
    request.get(`${API_BASE}/departments`, { headers: tokenHeader(token) }),
    request.get(`${API_BASE}/positions`, { headers: tokenHeader(token) }),
    request.get(`${API_BASE}/locations`, { headers: tokenHeader(token) }),
  ]);
  const departments = ((await deptRes.json()).data || []) as Array<{ id: string; name: string }>;
  const positions = ((await posRes.json()).data || []) as Array<{ id: string; name: string }>;
  const locations = ((await locRes.json()).data || []) as Array<{
    id: string;
    latitude: string;
    longitude: string;
  }>;
  return { departments, positions, locations };
}

export async function apiCreateEmployee(
  request: APIRequestContext,
  token: string,
  payload: Record<string, unknown>,
) {
  const res = await request.post(`${API_BASE}/employees`, {
    data: payload,
    headers: tokenHeader(token),
  });
  if (!res.ok()) {
    throw new Error(`Create employee failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.data?.id as string;
}

export async function apiFindEmployeeByName(
  request: APIRequestContext,
  token: string,
  fullName: string,
): Promise<string | null> {
  const res = await request.get(`${API_BASE}/employees`, {
    headers: tokenHeader(token),
    params: { search: fullName, limit: '50' },
  });
  const body = await res.json();
  const list = body.data || [];
  const found = list.find((e: { fullName: string }) => e.fullName === fullName);
  return found?.id ?? null;
}

export async function apiDeleteEmployee(request: APIRequestContext, token: string, id: string) {
  if (!id) return;
  await request.delete(`${API_BASE}/employees/${id}`, { headers: tokenHeader(token) });
}

export async function apiCreateUser(
  request: APIRequestContext,
  token: string,
  email: string,
  password: string,
) {
  const res = await request.post(`${API_BASE}/auth/users`, {
    data: { email, password, role: 'employee' },
    headers: tokenHeader(token),
  });
  if (!res.ok()) {
    throw new Error(`Create user failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return (body.data?.id || body.id) as string;
}

export async function apiDeleteUser(request: APIRequestContext, token: string, id: string) {
  if (!id) return;
  await request.delete(`${API_BASE}/auth/users/${id}`, { headers: tokenHeader(token) });
}