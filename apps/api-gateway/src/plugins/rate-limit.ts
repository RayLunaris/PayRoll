import { FastifyInstance } from 'fastify';
import { FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';

const UNRATE_LIMITED_PATHS = ['/', '/health', '/healthcheck', '/docs'];

export async function registerRateLimit(app: FastifyInstance) {
  const max = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  const timeWindow = process.env.RATE_LIMIT_WINDOW || '1 minute';

  await app.register(rateLimit, {
    global: true,
    max,
    timeWindow,
    allowList: (request: FastifyRequest) => {
      const path = request.url.split('?')[0];
      return UNRATE_LIMITED_PATHS.includes(path);
    },
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        statusCode: 429,
        error: 'RateLimitExceeded',
        message: `You have exceeded the rate limit of ${context.max} requests per ${context.after}. Please try again later.`,
        timestamp: new Date().toISOString(),
      };
    },
  });
}
