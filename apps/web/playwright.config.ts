import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
});