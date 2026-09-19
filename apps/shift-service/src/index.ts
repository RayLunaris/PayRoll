import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import './types/index.js';
import { db, users, eq } from '@payrollpro/db';
import { shiftRoutes } from './routes/shifts.js';


export async function buildApp() {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  // Register plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  await app.register(jwt, {
    secret: JWT_SECRET,
  });

  // Authenticate decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
      if (request.user?.type === 'refresh') {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }
    } catch (err) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }

    // Lock out deactivated accounts immediately, even with a valid token.
    const storedUser = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, request.user.id)).limit(1);
    if (storedUser.length === 0 || !storedUser[0].isActive) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  });

  // Register routes
  await app.register(shiftRoutes, { prefix: '/api/shifts' });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', service: 'shift-service' };
  });

  return app;
}

// Start server
export const start = async () => {
  try {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3016', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Shift service running on port ${port}`);
    return app;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  start();
}
