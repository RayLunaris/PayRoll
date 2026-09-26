import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginViaUi, getAdminToken, apiFindEmployeeByName } from './helpers';

test.describe('Accessibility Audits (a11y)', () => {
  test.beforeEach(() => {
    test.setTimeout(60000);
  });

  test('audit: /login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 1. Run Axe-Core Audit
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // 2. Global Page Checks snippet
    const globalChecks = await page.evaluate(() => ({
      lang: document.documentElement.lang || 'MISSING',
      title: document.title || 'MISSING',
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || 'MISSING',
    }));

    // 3. Orphaned inputs snippet
    const orphanedInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .filter((i) => {
          const input = i as HTMLInputElement;
          const hasId = input.id && document.querySelector(`label[for="${input.id}"]`);
          const hasAria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
          return !hasId && !hasAria && !input.closest('label');
        })
        .map((i) => ({
          tag: i.tagName,
          id: i.id,
          name: (i as HTMLInputElement).name,
          type: (i as HTMLInputElement).type,
        }));
    });

    console.log('--- /login a11y summary ---');
    console.log('Global checks:', globalChecks);
    console.log('Orphaned inputs:', orphanedInputs);
    console.log('Axe violations count:', axeResults.violations.length);
    if (axeResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(axeResults.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map(n => ({ html: n.html, target: n.target, failureSummary: n.failureSummary }))
      })), null, 2));
    }
  });

  test('audit: /dashboard page', async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const orphanedInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .filter((i) => {
          const input = i as HTMLInputElement;
          const hasId = input.id && document.querySelector(`label[for="${input.id}"]`);
          const hasAria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
          return !hasId && !hasAria && !input.closest('label');
        })
        .map((i) => ({
          tag: i.tagName,
          id: i.id,
          name: (i as HTMLInputElement).name,
          placeholder: (i as HTMLInputElement).placeholder,
        }));
    });

    // Check buttons missing accessible names
    const namelessButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a[role="button"]'))
        .filter((b) => {
          const btn = b as HTMLElement;
          const text = btn.innerText?.trim();
          const ariaLabel = btn.getAttribute('aria-label');
          const ariaLabelledby = btn.getAttribute('aria-labelledby');
          const title = btn.getAttribute('title');
          return !text && !ariaLabel && !ariaLabelledby && !title;
        })
        .map((b) => b.outerHTML.slice(0, 100));
    });

    console.log('--- /dashboard a11y summary ---');
    console.log('Orphaned inputs:', orphanedInputs);
    console.log('Nameless buttons:', namelessButtons);
    console.log('Axe violations count:', axeResults.violations.length);
    if (axeResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(axeResults.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map(n => ({ html: n.html, target: n.target, failureSummary: n.failureSummary }))
      })), null, 2));
    }
  });

  test('audit: /employees page', async ({ page }) => {
    await loginViaUi(page);
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const orphanedInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .filter((i) => {
          const input = i as HTMLInputElement;
          const hasId = input.id && document.querySelector(`label[for="${input.id}"]`);
          const hasAria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
          return !hasId && !hasAria && !input.closest('label');
        })
        .map((i) => ({
          tag: i.tagName,
          id: i.id,
          placeholder: (i as HTMLInputElement).placeholder,
        }));
    });

    console.log('--- /employees a11y summary ---');
    console.log('Orphaned inputs:', orphanedInputs);
    console.log('Axe violations count:', axeResults.violations.length);
    if (axeResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(axeResults.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map(n => ({ html: n.html, target: n.target, failureSummary: n.failureSummary }))
      })), null, 2));
    }
  });

  test('audit: /employees/[id]/edit page', async ({ page, request }) => {
    const token = await getAdminToken(request);
    const empRes = await request.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/employees?limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await empRes.json();
    const existingId = body.data?.[0]?.id;
    if (!existingId) {
      console.log('No employee found, skipping specific edit page check');
      return;
    }

    await loginViaUi(page);
    await page.goto(`/employees/${existingId}/edit`);
    await page.waitForLoadState('networkidle');

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const orphanedInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .filter((i) => {
          const input = i as HTMLInputElement;
          const hasId = input.id && document.querySelector(`label[for="${input.id}"]`);
          const hasAria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
          return !hasId && !hasAria && !input.closest('label');
        })
        .map((i) => ({
          tag: i.tagName,
          id: i.id,
          name: (i as HTMLInputElement).name,
        }));
    });

    console.log('--- /employees/[id]/edit a11y summary ---');
    console.log('Orphaned inputs:', orphanedInputs);
    console.log('Axe violations count:', axeResults.violations.length);
    if (axeResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(axeResults.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map(n => ({ html: n.html, target: n.target, failureSummary: n.failureSummary }))
      })), null, 2));
    }
  });

  test('audit: /employees/add page', async ({ page }) => {
    await loginViaUi(page);
    await page.goto('/employees/add');
    await page.waitForLoadState('networkidle');

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const orphanedInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .filter((i) => {
          const input = i as HTMLInputElement;
          const hasId = input.id && document.querySelector(`label[for="${input.id}"]`);
          const hasAria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
          return !hasId && !hasAria && !input.closest('label');
        })
        .map((i) => ({
          tag: i.tagName,
          id: i.id,
          name: (i as HTMLInputElement).name,
        }));
    });

    console.log('--- /employees/add a11y summary ---');
    console.log('Orphaned inputs:', orphanedInputs);
    console.log('Axe violations count:', axeResults.violations.length);
    if (axeResults.violations.length > 0) {
      console.log('Axe violations:', JSON.stringify(axeResults.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map(n => ({ html: n.html, target: n.target, failureSummary: n.failureSummary }))
      })), null, 2));
    }
  });
});
