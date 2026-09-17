import Redis from 'ioredis';

const REDIS_CHANNEL = 'payrollpro:events';
let publisher: Redis | null = null;

export function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
    });
  }
  return publisher;
}

export async function publishEvent(event: Record<string, unknown>): Promise<void> {
  try {
    const pub = getPublisher();
    await pub.publish(REDIS_CHANNEL, JSON.stringify(event));
  } catch (err) {
    console.error('[social-service] Redis publish failed:', err);
  }
}