import Redis from 'ioredis';
import crypto from 'crypto';

// In-memory fallback map if Redis is not reachable
const memStore = new Map<string, number>();

let redisClient: Redis | null = null;
let redisAvailable = false;

try {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisClient = new (Redis as any)(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 100, 1000)),
  });

  redisClient?.on('connect', () => {
    redisAvailable = true;
  });

  redisClient?.on('error', () => {
    redisAvailable = false;
  });

  redisClient?.connect().then(() => {
    redisAvailable = true;
  }).catch(() => {
    redisAvailable = false;
  });
} catch (e) {
  redisAvailable = false;
}

export function generateJti(): string {
  return crypto.randomUUID();
}

export async function storeRefreshToken(userId: string, jti: string, ttlSeconds: number = 7 * 24 * 3600): Promise<void> {
  const key = `rt:${userId}:${jti}`;
  if (redisAvailable && redisClient) {
    try {
      await redisClient.setex(key, ttlSeconds, 'valid');
      return;
    } catch (err) {
      // Fallback
    }
  }
  memStore.set(key, Date.now() + ttlSeconds * 1000);
}

export async function isRefreshTokenValid(userId: string, jti: string): Promise<boolean> {
  const key = `rt:${userId}:${jti}`;
  if (redisAvailable && redisClient) {
    try {
      const val = await redisClient.get(key);
      return val === 'valid';
    } catch (err) {
      // Fallback
    }
  }
  const expiry = memStore.get(key);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    memStore.delete(key);
    return false;
  }
  return true;
}

export async function revokeRefreshToken(userId: string, jti: string): Promise<void> {
  const key = `rt:${userId}:${jti}`;
  if (redisAvailable && redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch (err) {
      // Fallback
    }
  }
  memStore.delete(key);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const pattern = `rt:${userId}:*`;
  if (redisAvailable && redisClient) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return;
    } catch (err) {
      // Fallback
    }
  }
  for (const key of memStore.keys()) {
    if (key.startsWith(`rt:${userId}:`)) {
      memStore.delete(key);
    }
  }
}
