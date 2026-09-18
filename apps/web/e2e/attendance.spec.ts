import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import {
  loginViaUi,
  getAdminToken,
  fetchRefs,
  apiCreateEmployee,
  apiCreateUser,
  apiDeleteEmployee,
  apiDeleteUser,
} from './helpers';

// Head Office seeded coordinate (radius 100m)
const HEAD_OFFICE_LAT = -6.2088;
const HEAD_OFFICE_LNG = 106.8456;

const psql = (sql: string) =>
  execSync(`docker exec payrollpro-postgres psql -q -U postgres -d payrollpro -t -A -c "${sql}"`, {
    stdio: 'pipe',
  }).toString();

test.describe('Attendance Flow', () => {
  test.use({
    geolocation: { latitude: HEAD_OFFICE_LAT, longitude: HEAD_OFFICE_LNG },
    permissions: ['geolocation'],
  });

  test.beforeEach(() => {
    test.setTimeout(90000);
  });

  test('should allow employee check-in at valid location', async ({ page, request }) => {
    const token = await getAdminToken(request);
    const { departments, positions, locations } = await fetchRefs(request, token);
    const headOffice = locations[0];

    const suffix = Date.now().toString(36);
    const email = `e2e_att_${suffix}@payrollpro.com`;
    const password = 'testpassword123';
    const nip = `E2E-ATT-${suffix.toUpperCase()}`;

    let userId = '';
    let employeeId = '';

    try {
      userId = await apiCreateUser(request, token, email, password);
      employeeId = await apiCreateEmployee(request, token, {
        userId,
        nip,
        fullName: `E2E Attendance ${suffix}`,
        departmentId: departments[0].id,
        positionId: positions[0].id,
        locationId: headOffice.id,
        joinDate: '2025-01-01',
        baseSalary: 5000000,
      });

      await loginViaUi(page, email, password);
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      await page.goto('/attendance/check-in');
      await expect(page.getByText('Check-in menggunakan verifikasi lokasi GPS')).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('Lokasi terdeteksi')).toBeVisible({ timeout: 15000 });

      const locationSelect = page.locator('select').first();
      const targetOption = locationSelect.locator(`option[value="${headOffice.id}"]`);
      await expect(targetOption).toHaveCount(1, { timeout: 20000 });
      await locationSelect.selectOption(headOffice.id);

      await page.getByRole('button', { name: 'Check-in Sekarang' }).click();

      await expect(page.getByText('Check-in berhasil!')).toBeVisible({ timeout: 15000 });
    } finally {
      // Remove attendance rows first (FK), then employee, then auth user
      if (employeeId) {
        psql(`DELETE FROM attendances WHERE employee_id = '${employeeId}';`);
        await apiDeleteEmployee(request, token, employeeId);
      }
      if (userId) {
        await apiDeleteUser(request, token, userId);
      }
    }
  });
});