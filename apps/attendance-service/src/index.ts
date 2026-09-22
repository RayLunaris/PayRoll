import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import './types/index.js';
import { db, users, eq } from '@payrollpro/db';
import cron from 'node-cron';
import { attendanceRoutes } from './routes/attendance.js';
import { attendanceActivityRoutes } from './routes/activities.js';
import { getWIBDateString, getWIBTimeString } from '@payrollpro/shared-types';

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
  await app.register(attendanceRoutes, { prefix: '/api/attendance' });
  await app.register(attendanceActivityRoutes, { prefix: '/api/attendance' });
  await app.register(attendanceActivityRoutes, { prefix: '/' });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', service: 'attendance-service' };
  });

  return app;
}

// Start server
export const start = async () => {
  try {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3013', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Attendance service running on port ${port}`);

    // Schedule auto check-out at WIB midnight (00:00 Asia/Jakarta), independent
    // of the server's own timezone. Runs every minute, guarded to fire once per
    // WIB day when the wall clock is exactly at the top of the hour.
    let lastAutoCheckoutDay = '';
    cron.schedule('* * * * *', async () => {
      try {
        const today = getWIBDateString();
        if (getWIBTimeString().slice(0, 3) !== '00:') return;
        if (lastAutoCheckoutDay === today) return;
        lastAutoCheckoutDay = today;

        const { performAutoCheckout } = await import('./routes/attendance.js');
        const processed = await performAutoCheckout();
        console.log(`Automated WIB midnight check-out processed ${processed} records`);
      } catch (err) {
        console.error('Automated midnight check-out error:', err);
      }
    });

    return app;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  start();
}
