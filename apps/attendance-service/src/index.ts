import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import './types/index.js';
import cron from 'node-cron';
import { attendanceRoutes } from './routes/attendance.js';
import { getWIBDateString, getWIBTimeString } from '@payrollpro/shared-types';

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

  // Authenticate decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  });

  // Register routes
  await app.register(attendanceRoutes, { prefix: '/api/attendance' });

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
