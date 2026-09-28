import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, notifications, eq, and, desc, sql } from '@payrollpro/db';

export async function notificationRoutes(app: FastifyInstance) {
  // 1. Get notifications for the authenticated user
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { page = '1', limit = '20', unreadOnly } = request.query as {
        page?: string;
        limit?: string;
        unreadOnly?: string;
      };

      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (parsedPage - 1) * parsedLimit;

      const conditions = [eq(notifications.userId, user.id)];
      if (unreadOnly === 'true' || unreadOnly === '1') {
        conditions.push(eq(notifications.isRead, false));
      }

      const [data, [countResult]] = await Promise.all([
        db
          .select()
          .from(notifications)
          .where(and(...conditions))
          .orderBy(desc(notifications.createdAt))
          .limit(parsedLimit)
          .offset(offset),
        db
          .select({ count: sql<string>`count(*)` })
          .from(notifications)
          .where(and(...conditions)),
      ]);

      const total = parseInt(countResult?.count || '0', 10);

      return reply.send({
        success: true,
        data,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages: Math.ceil(total / parsedLimit),
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 2. Get unread notifications count for badge
  app.get('/unread-count', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;

      const [result] = await db
        .select({ count: sql<string>`count(*)` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, user.id),
            eq(notifications.isRead, false)
          )
        );

      const count = parseInt(result?.count || '0', 10);

      return reply.send({
        success: true,
        count,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 3. Mark single notification as read
  app.put('/:id/read', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Notification not found' });
      }

      const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id))
        .returning();

      return reply.send({ success: true, data: updated });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 4. Mark all notifications as read for current user
  app.put('/read-all', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, user.id),
            eq(notifications.isRead, false)
          )
        );

      return reply.send({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 5. Delete single notification
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };

      const [deleted] = await db
        .delete(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
        .returning();

      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Notification not found' });
      }

      return reply.send({ success: true, message: 'Notification deleted' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
