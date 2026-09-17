import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import './types/index.js';
import { authRoutes } from './routes/auth.js';
import { registerAuthMiddleware } from './middleware/auth.js';

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  // Register plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
  });

  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
  });

  // Register auth middleware
  await registerAuthMiddleware(app);

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', service: 'auth-service' };
  });

  return app;
}

// Start server
export const start = async () => {
  try {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3010', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Auth service running on port ${port}`);
    return app;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  start();
}
