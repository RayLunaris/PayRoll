import { defineConfig } from 'vitest/config';

const testDb = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/payrollpro_test';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: testDb,
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      JWT_SECRET: process.env.JWT_SECRET || 'payrollpro-test-jwt-secret',
      NODE_ENV: 'test',
    },
  },
});