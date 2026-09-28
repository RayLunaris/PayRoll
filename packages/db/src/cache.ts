import Redis from 'ioredis';

// In-memory fallback cache: key -> { value: string, expiry: number }
interface CacheEntry {
  value: string;
  expiry: number;
}

const memCache = new Map<string, CacheEntry>();
const MAX_MEM_ENTRIES = 5_000;

let redisClient: Redis | null = null;
let redisAvailable = false;

function initRedis() {
  if (redisClient) return;

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
  } catch {
    redisAvailable = false;
  }
}

// Clean up expired entries in memory store
function pruneMemoryCache(now: number) {
  for (const [key, entry] of memCache.entries()) {
    if (entry.expiry <= now) {
      memCache.delete(key);
    }
  }
  if (memCache.size >= MAX_MEM_ENTRIES) {
    const overflow = memCache.size - MAX_MEM_ENTRIES + 1;
    const it = memCache.keys();
    for (let i = 0; i < overflow; i++) {
      const oldestKey = it.next().value;
      if (!oldestKey) break;
      memCache.delete(oldestKey);
    }
  }
}

/**
 * Retrieves a value from cache or executes fetcher, caching the result.
 * @param key Cache key
 * @param ttlSeconds TTL in seconds
 * @param fetcher Async function to retrieve the data if not cached
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  initRedis();
  const now = Date.now();

  // 1. Try Redis first if available
  if (redisAvailable && redisClient) {
    try {
      const cached = await redisClient.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch {
      redisAvailable = false;
    }
  }

  // 2. Try In-Memory Cache
  const memEntry = memCache.get(key);
  if (memEntry && memEntry.expiry > now) {
    try {
      return JSON.parse(memEntry.value) as T;
    } catch {
      memCache.delete(key);
    }
  }

  // 3. Cache miss: invoke fetcher
  const freshData = await fetcher();

  // 4. Store in cache
  const serialized = JSON.stringify(freshData);

  if (redisAvailable && redisClient) {
    try {
      await redisClient.set(key, serialized, 'EX', ttlSeconds);
    } catch {
      redisAvailable = false;
    }
  }

  // Always mirror to in-memory cache for speed and redundancy
  pruneMemoryCache(now);
  memCache.set(key, {
    value: serialized,
    expiry: now + ttlSeconds * 1000,
  });

  return freshData;
}

/**
 * Sets a value directly in cache.
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  initRedis();
  const now = Date.now();
  const serialized = JSON.stringify(value);

  if (redisAvailable && redisClient) {
    try {
      await redisClient.set(key, serialized, 'EX', ttlSeconds);
    } catch {
      redisAvailable = false;
    }
  }

  pruneMemoryCache(now);
  memCache.set(key, {
    value: serialized,
    expiry: now + ttlSeconds * 1000,
  });
}

/**
 * Invalidates cache by exact key or prefix pattern.
 * e.g. 'departments', 'bpjs:config', 'locations:*'
 */
export async function invalidateCache(patternOrKey: string): Promise<void> {
  initRedis();

  // Invalidate in memory
  if (patternOrKey.endsWith('*')) {
    const prefix = patternOrKey.slice(0, -1);
    for (const key of memCache.keys()) {
      if (key.startsWith(prefix)) {
        memCache.delete(key);
      }
    }
  } else {
    memCache.delete(patternOrKey);
  }

  // Invalidate in Redis
  if (redisAvailable && redisClient) {
    try {
      if (patternOrKey.endsWith('*')) {
        const keys = await redisClient.keys(patternOrKey);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } else {
        await redisClient.del(patternOrKey);
      }
    } catch {
      redisAvailable = false;
    }
  }
}
