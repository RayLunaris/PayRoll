import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import './types/index.js';
import { registerSecurity } from './plugins/security.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerProxy } from './plugins/proxy.js';
import { docsRoutes } from './routes/docs.js';

export async function buildApp() {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  // 1. CORS Configuration
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  });

  // 2. JWT Configuration
  await app.register(jwt, {
    secret: JWT_SECRET,
  });

  // 3. Authenticate decorator for Edge JWT verification
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err: any) {
      return reply.status(401).send({
        success: false,
        statusCode: 401,
        error: 'Unauthorized',
        message: err.message || 'Authentication required or invalid token',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 4. Rate Limiting Plugin
  await registerRateLimit(app);

  // 5. Multipart passthrough (buffered) for file upload proxying
  app.addContentTypeParser(
    ['multipart/form-data', 'application/octet-stream'],
    { parseAs: 'buffer', bodyLimit: 10 * 1024 * 1024 },
    (request, payload, done) => {
      done(null, payload);
    }
  );

  // 6. Security Headers Plugin (Helmet)
  await registerSecurity(app);

  // 7. Centralized Error Handler
  registerErrorHandler(app);

  // 8. Documentation and Health Routes
  await app.register(docsRoutes, { prefix: '/' });

  // 9. Liveness and Root Endpoints
  app.get('/', async () => {
    return {
      name: 'PayrollPro API Gateway',
      version: '1.0.0',
      docs: '/docs',
      health: '/health',
      healthcheck: '/healthcheck',
    };
  });

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  });

  // 9. Reverse Proxy Registration
  await registerProxy(app);

  return app;
}

export const start = async () => {
  try {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3001', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`API Gateway running on port ${port}`);
    return app;
  } catch (err) {
    console.error('Fatal error starting API Gateway:', err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  start();
}
