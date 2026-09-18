import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers';

test.describe('Authentication Flow', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /masuk/i })).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('wrong@payroll.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('.bg-red-50').first()).toBeVisible({ timeout: 5000 });
  });

  test('should allow login with admin credentials', async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await expect(page.locator('text=Dashboard').first()).toBeAttached();
  });
});