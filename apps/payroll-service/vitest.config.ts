import { defineConfig } from 'vitest/config';

const testDb = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/payrollpro_test';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_URL: testDb,
      JWT_SECRET: process.env.JWT_SECRET || 'payrollpro-test-jwt-secret',
      NODE_ENV: 'test',
    },
  },
});