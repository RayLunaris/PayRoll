import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, announcements, users, employees, eq, and, desc } from '@payrollpro/db';
import { publishEvent } from '../services/redis-publisher.js';

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  content: z.string().min(1, 'Content is required'),
  priority: z.enum(['normal', 'urgent']).default('normal'),
  attachmentUrl: z.string().optional(),
  targetAudience: z.enum(['all', 'department', 'location']).default('all'),
  targetId: z.string().uuid().optional(),
});

const updateAnnouncementSchema = announcementSchema.partial();

export async function announcementRoutes(app: FastifyInstance) {
  // 1. Get announcements list
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const isAdmin = ['hr_admin', 'super_admin'].includes(user.role);

      const conditions = [];

      // Regular employees only see published announcements
      if (!isAdmin) {
        conditions.push(eq(announcements.isPublished, true));
      } else {
        const query = request.query as { publishedOnly?: string };
        if (query.publishedOnly === 'true') {
          conditions.push(eq(announcements.isPublished, true));
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const data = await db.select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        priority: announcements.priority,
        attachmentUrl: announcements.attachmentUrl,
        targetAudience: announcements.targetAudience,
        targetId: announcements.targetId,
        isPublished: announcements.isPublished,
        publishedAt: announcements.publishedAt,
        createdAt: announcements.createdAt,
        updatedAt: announcements.updatedAt,
        createdById: announcements.createdBy,
        authorEmail: users.email,
        authorName: employees.fullName,
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.createdBy, users.id))
      .leftJoin(employees, eq(users.id, employees.userId))
      .where(whereClause)
      .orderBy(desc(announcements.createdAt));

      return reply.send({ success: true, data });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 2. Get single announcement by ID
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };
      const isAdmin = ['hr_admin', 'super_admin'].includes(user.role);

      const [announcement] = await db.select({
        id: announcements.id,
        title: announcements.title,
        content: announcements.content,
        priority: announcements.priority,
        attachmentUrl: announcements.attachmentUrl,
        targetAudience: announcements.targetAudience,
        targetId: announcements.targetId,
        isPublished: announcements.isPublished,
        publishedAt: announcements.publishedAt,
        createdAt: announcements.createdAt,
        updatedAt: announcements.updatedAt,
        createdById: announcements.createdBy,
        authorEmail: users.email,
        authorName: employees.fullName,
      })
      .from(announcements)
      .leftJoin(users, eq(announcements.createdBy, users.id))
      .leftJoin(employees, eq(users.id, employees.userId))
      .where(eq(announcements.id, id))
      .limit(1);

      if (!announcement) {
        return reply.status(404).send({ success: false, error: 'Announcement not found' });
      }

      if (!announcement.isPublished && !isAdmin) {
        return reply.status(404).send({ success: false, error: 'Announcement not found' });
      }

      return reply.send({ success: true, data: announcement });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 3. Create announcement (HR / Super Admin only)
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const body = announcementSchema.parse(request.body);

      const [newAnnouncement] = await db.insert(announcements).values({
        title: body.title,
        content: body.content,
        priority: body.priority,
        attachmentUrl: body.attachmentUrl || null,
        targetAudience: body.targetAudience,
        targetId: body.targetId || null,
        createdBy: user.id,
        isPublished: false,
      }).returning();

      return reply.status(201).send({ success: true, data: newAnnouncement });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 4. Publish announcement (HR / Super Admin only)
  app.put('/:id/publish', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const { id } = request.params as { id: string };

      const [updated] = await db.update(announcements)
        .set({
          isPublished: true,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(announcements.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Announcement not found' });
      }

      // Broadcast to all connected employees via WebSocket (PRD 9.7)
      await publishEvent({
        event: 'new_announcement',
        type: 'announcement',
        data: {
          id: updated.id,
          title: updated.title,
          content: updated.content,
          priority: updated.priority,
          publishedAt: updated.publishedAt,
        },
      });

      return reply.send({ success: true, data: updated, message: 'Announcement published successfully' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 5. Update announcement (HR / Super Admin only)
  app.put('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const { id } = request.params as { id: string };
      const body = updateAnnouncementSchema.parse(request.body);

      const [updated] = await db.update(announcements)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(announcements.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Announcement not found' });
      }

      return reply.send({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 6. Delete announcement (HR / Super Admin only)
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Insufficient privileges' });
      }

      const { id } = request.params as { id: string };

      const [deleted] = await db.delete(announcements).where(eq(announcements.id, id)).returning();
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Announcement not found' });
      }

      return reply.send({ success: true, message: 'Announcement deleted successfully' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
