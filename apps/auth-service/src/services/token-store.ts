import Redis from 'ioredis';
import crypto from 'crypto';

// In-memory fallback: tokens are ALWAYS mirrored here so behavior stays
// consistent even when Redis flips between available and unavailable.
const memStore = new Map<string, number>(); // key -> expiry (ms epoch)
const userIndex = new Map<string, Set<string>>(); // userId -> set of memStore keys
const MAX_MEM_ENTRIES = 10_000;

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

// Evict expired + oldest entries so the in-memory store stays bounded.
function pruneMemStore(now: number) {
  for (const [key, expiry] of memStore.entries()) {
    if (expiry <= now) {
      memStore.delete(key);
      const sep = key.indexOf(':');
      const uid = sep > -1 ? key.slice(sep + 1, key.indexOf(':', sep + 1)) : '';
      const userKeys = uid ? userIndex.get(uid) : undefined;
      if (userKeys) {
        userKeys.delete(key);
        if (userKeys.size === 0) userIndex.delete(uid);
      }
    }
  }
  if (memStore.size >= MAX_MEM_ENTRIES) {
    const overflow = memStore.size - MAX_MEM_ENTRIES + 1;
    const it = memStore.keys();
    for (let i = 0; i < overflow; i++) {
      const oldestKey = it.next().value as string | undefined;
      if (!oldestKey) break;
      memStore.delete(oldestKey);
      const sep = oldestKey.indexOf(':');
      const uid = sep > -1 ? oldestKey.slice(sep + 1, oldestKey.indexOf(':', sep + 1)) : '';
      const userKeys = uid ? userIndex.get(uid) : undefined;
      if (userKeys) {
        userKeys.delete(oldestKey);
        if (userKeys.size === 0) userIndex.delete(uid);
      }
    }
  }
}

function memSet(key: string, ttlSeconds: number) {
  const now = Date.now();
  pruneMemStore(now);
  memStore.set(key, now + ttlSeconds * 1000);

  const sep = key.indexOf(':');
  if (sep > -1) {
    const uid = key.slice(sep + 1, key.indexOf(':', sep + 1));
    if (uid) {
      if (!userIndex.has(uid)) userIndex.set(uid, new Set());
      userIndex.get(uid)!.add(key);
    }
  }
}

export function generateJti(): string {
  return crypto.randomUUID();
}

export async function storeRefreshToken(userId: string, jti: string, ttlSeconds: number = 7 * 24 * 3600): Promise<void> {
  const key = `rt:${userId}:${jti}`;
  // Always mirror to memory so reads work regardless of Redis state.
  memSet(key, ttlSeconds);
  if (redisAvailable && redisClient) {
    try {
      await redisClient.setex(key, ttlSeconds, 'valid');
    } catch (err) {
      // Memory copy already covers this token.
    }
  }
}

export async function isRefreshTokenValid(userId: string, jti: string): Promise<boolean> {
  const key = `rt:${userId}:${jti}`;

  if (redisAvailable && redisClient) {
    try {
      const val = await redisClient.get(key);
      if (val === 'valid') return true;
    } catch (err) {
      // Fall back to memory copy below.
    }
  }

  const expiry = memStore.get(key);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    memStore.delete(key);
    const userKeys = userIndex.get(userId);
    userKeys?.delete(key);
    if (userKeys && userKeys.size === 0) userIndex.delete(userId);
    return false;
  }
  return true;
}

export async function revokeRefreshToken(userId: string, jti: string): Promise<void> {
  const key = `rt:${userId}:${jti}`;

  // Remove in-memory copy first and always, even if Redis is available.
  memStore.delete(key);
  const userKeys = userIndex.get(userId);
  userKeys?.delete(key);
  if (userKeys && userKeys.size === 0) userIndex.delete(userId);

  if (redisAvailable && redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {
      // Redis copy may persist; memory copy is authoritative in this degraded path.
    }
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  // Enumerate via the user index so revocation is complete regardless of
  // which store (Redis or memory) a token currently lives in.
  const memKeys = userIndex.get(userId);
  if (memKeys) {
    for (const key of [...memKeys]) {
      memStore.delete(key);
    }
    userIndex.delete(userId);
  }

  if (redisAvailable && redisClient) {
    try {
      const keys = await redisClient.keys(`rt:${userId}:*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (err) {
      // Redis copies are already invalidated via TTL; memory copy is fully cleared.
    }
  }
}

// ---------------------------------------------------------------------------
// Per-account login lockout (anti brute-force). IP-level rate limiting handles
// distributed attempts; this protects a single known account.
// ---------------------------------------------------------------------------

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface LockRecord {
  count: number;
  lockedUntil: number;
}

const lockStore = new Map<string, LockRecord>();

function lockKey(email: string): string {
  return `lock:${email.toLowerCase().trim()}`;
}

function mirrorLock(key: string, rec: LockRecord): void {
  if (redisAvailable && redisClient) {
    redisClient.setex(key, Math.ceil(LOGIN_LOCK_WINDOW_MS / 1000), JSON.stringify(rec)).catch(() => undefined);
  }
}

async function readLock(key: string): Promise<LockRecord | undefined> {
  const mem = lockStore.get(key);
  if (mem && (!mem.lockedUntil || Date.now() < mem.lockedUntil)) {
    return mem;
  }
  if (mem && mem.lockedUntil && Date.now() >= mem.lockedUntil) {
    lockStore.delete(key);
  }
  if (redisAvailable && redisClient) {
    try {
      const raw = await redisClient.get(key);
      if (raw) {
        const rec = JSON.parse(raw) as LockRecord;
        if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
          return rec;
        }
      }
    } catch (err) {
      // Fall back to the in-memory copy.
    }
  }
  return undefined;
}

// Called after every failed login attempt (including "user not found" so the
// endpoint does not leak which accounts exist).
export async function recordFailedLogin(email: string): Promise<void> {
  const key = lockKey(email);
  const now = Date.now();
  const cur = await readLock(key);
  const rec: LockRecord = !cur
    ? { count: 1, lockedUntil: 0 }
    : { count: cur.count + 1, lockedUntil: cur.count + 1 >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_LOCK_WINDOW_MS : 0 };
  lockStore.set(key, rec);
  mirrorLock(key, rec);
}

export async function isLoginLocked(email: string): Promise<boolean> {
  const rec = await readLock(lockKey(email));
  return !!rec && rec.lockedUntil > Date.now();
}

export async function clearLoginLockout(email: string): Promise<void> {
  const key = lockKey(email);
  lockStore.delete(key);
  if (redisAvailable && redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {
      // Memory copy is already cleared.
    }
  }
}