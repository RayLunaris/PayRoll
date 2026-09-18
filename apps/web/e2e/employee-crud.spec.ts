import { test, expect } from '@playwright/test';
import {
  loginViaUi,
  getAdminToken,
  fetchRefs,
  apiCreateEmployee,
  apiDeleteEmployee,
  apiFindEmployeeByName,
} from './helpers';

test.describe('Employee Management (HR)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should create employee through UI', async ({ page, request }) => {
    const token = await getAdminToken(request);
    const { departments, positions, locations } = await fetchRefs(request, token);

    const nip = `E2E-${Date.now()}`;
    const fullName = `E2E User ${Date.now()}`;

    let createdId: string | null = null;
    try {
      await page.goto('/employees/add');
      await page.locator('input[name="nip"]').fill(nip);
      await page.locator('input[name="fullName"]').fill(fullName);
      await page.locator('input[name="birthDate"]').fill('1995-01-01');
      await page.locator('input[name="joinDate"]').fill('2025-01-01');
      await page.locator('input[name="phone"]').fill('081234567890');
      await page.locator('textarea[name="address"]').fill('Jl. Test No. 1, Jakarta');
      await page.selectOption('select[name="departmentId"]', departments[0].id);
      await page.selectOption('select[name="positionId"]', positions[0].id);
      await page.selectOption('select[name="locationId"]', locations[0].id);
      await page.locator('input[name="baseSalary"]').fill('5000000');
      await page.locator('input[name="bankName"]').fill('BCA');
      await page.locator('input[name="bankAccount"]').fill('1234567890');
      await page.locator('input[name="npwp"]').fill('123456789012345');

      await page.getByRole('button', { name: 'Simpan Karyawan' }).click();

      await expect(page).toHaveURL(/\/employees$/, { timeout: 10000 });
      await page.getByPlaceholder('Cari nama karyawan...').fill(fullName);
      await page.getByRole('button', { name: 'Cari' }).click();
      const row = page.locator('tr', { hasText: nip });
      await expect(row).toHaveCount(1, { timeout: 10000 });
      createdId = await apiFindEmployeeByName(request, token, fullName);
      expect(createdId).toBeTruthy();
    } finally {
      createdId = createdId || (await apiFindEmployeeByName(request, token, fullName));
      await apiDeleteEmployee(request, token, createdId || '');
    }
  });

  test('should find employee via search', async ({ page, request }) => {
    const token = await getAdminToken(request);
    const { departments, positions, locations } = await fetchRefs(request, token);

    const nip = `E2E-S-${Date.now()}`;
    const fullName = `E2E Search User ${Date.now()}`;
    let createdId: string | null = null;

    try {
      createdId = await apiCreateEmployee(request, token, {
        nip,
        fullName,
        departmentId: departments[0].id,
        positionId: positions[0].id,
        locationId: locations[0].id,
        joinDate: '2025-01-01',
        baseSalary: 5000000,
        phone: '081234567890',
      });
      expect(createdId).toBeTruthy();

      await page.goto('/employees');
      await page.getByPlaceholder('Cari nama karyawan...').fill(fullName);
      await page.getByRole('button', { name: 'Cari' }).click();
      const row = page.locator('tr', { hasText: nip });
      await expect(row).toHaveCount(1, { timeout: 10000 });
    } finally {
      createdId = createdId || (await apiFindEmployeeByName(request, token, fullName));
      await apiDeleteEmployee(request, token, createdId || '');
    }
  });
});