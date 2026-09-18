import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';

describe('Redis Integration', () => {
  let client: Redis;

  beforeAll(async () => {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
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
    await client.set('temp-key', 'temp', 'EX', 1);
    const immediate = await client.get('temp-key');
    expect(immediate).toBe('temp');

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const expired = await client.get('temp-key');
    expect(expired).toBeNull();
  });
});