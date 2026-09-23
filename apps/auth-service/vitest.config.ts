import { defineConfig } from 'vitest/config';

const testDb = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/payrollpro_test';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    env: {
      DATABASE_URL: testDb,
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      JWT_SECRET: process.env.JWT_SECRET || 'payrollpro-test-jwt-secret',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'payrollpro-test-jwt-refresh-secret',
      NODE_ENV: 'test',
    },
  },
});