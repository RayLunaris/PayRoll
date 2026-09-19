import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fs from 'fs/promises';
import path from 'path';
import './types/index.js';
import { db, users, eq } from '@payrollpro/db';
import { postRoutes } from './routes/posts.js';
import { messageRoutes } from './routes/messages.js';
import { announcementRoutes } from './routes/announcements.js';
import { randomUUID } from 'crypto';

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv',
]);

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

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 1,
    },
  });

  // Static file serving for uploaded content
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  await fs.mkdir(uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    maxAge: '7d',
  });
  app.decorate('uploadDir', uploadDir);

  // Authenticate decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
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
  await app.register(postRoutes, { prefix: '/api/posts' });
  await app.register(messageRoutes, { prefix: '/api/messages' });
  await app.register(announcementRoutes, { prefix: '/api/announcements' });

  // File upload (PRD 9.8)
  app.post('/api/uploads', {
    preHandler: [app.authenticate],
  }, async (request: any, reply: any) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' });
      }

      const ext = path.extname(data.filename || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return reply.status(400).send({ success: false, error: `File type not allowed: ${ext || 'unknown'}` });
      }

      const filename = `${randomUUID()}${ext}`;
      const targetPath = path.join(app.uploadDir, filename);

      const buffer = await data.toBuffer();
      if (buffer.byteLength > 10 * 1024 * 1024) {
        return reply.status(400).send({ success: false, error: 'File exceeds 10 MB limit' });
      }

      await fs.writeFile(targetPath, buffer);

      return reply.status(201).send({
        success: true,
        data: {
          filename,
          url: `/uploads/${filename}`,
          size: buffer.byteLength,
          mimetype: data.mimetype,
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', service: 'social-service' };
  });

  return app;
}

// Start server
export const start = async () => {
  try {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3015', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Social service running on port ${port}`);
    return app;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  start();
}
