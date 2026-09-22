import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, messages, users, employees, departments, positions, eq, ne, and, or, asc, desc, inArray } from '@payrollpro/db';
import { publishEvent } from '../services/redis-publisher.js';

const messageSchema = z.object({
  receiverId: z.string().uuid('Invalid receiver ID format'),
  content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message cannot exceed 5000 characters'),
});

export async function messageRoutes(app: FastifyInstance) {
  // 1. Send direct message
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = messageSchema.parse(request.body);

      // Prevent messaging oneself
      if (body.receiverId === user.id) {
        return reply.status(400).send({ success: false, error: 'Cannot send message to yourself' });
      }

      // Verify recipient exists
      const [receiver] = await db.select().from(users).where(eq(users.id, body.receiverId)).limit(1);
      if (!receiver) {
        return reply.status(404).send({ success: false, error: 'Recipient not found' });
      }

      const [newMessage] = await db.insert(messages).values({
        senderId: user.id,
        receiverId: body.receiverId,
        content: body.content,
        isRead: false,
      }).returning();

      // Real-time push notification to the recipient via WebSocket (PRD 9.7)
      await publishEvent({
        event: 'new_message',
        type: 'message',
        toUserId: body.receiverId,
        data: {
          id: newMessage.id,
          senderId: user.id,
          receiverId: body.receiverId,
          content: body.content,
          createdAt: newMessage.createdAt,
        },
      });

      return reply.status(201).send({ success: true, data: newMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 2. Get active conversations list (distinct chat partners with unread count and latest message)
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;

      const userMessages = await db.select()
        .from(messages)
        .where(or(
          eq(messages.senderId, user.id),
          eq(messages.receiverId, user.id)
        ))
        .orderBy(desc(messages.createdAt));

      const partnerMap = new Map<string, {
        partnerId: string;
        lastMessage: string;
        lastMessageAt: Date | null;
        unreadCount: number;
      }>();

      for (const msg of userMessages) {
        const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
        if (!partnerId) continue;

        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, {
            partnerId,
            lastMessage: msg.content,
            lastMessageAt: msg.createdAt,
            unreadCount: 0,
          });
        }

        if (msg.receiverId === user.id && !msg.isRead) {
          const entry = partnerMap.get(partnerId)!;
          entry.unreadCount += 1;
        }
      }

      const partnerIds = Array.from(partnerMap.keys());
      const partnerDetailsMap = new Map<string, { email: string; name?: string | null; role: string }>();

      if (partnerIds.length > 0) {
        const details = await db.select({
          userId: users.id,
          email: users.email,
          role: users.role,
          name: employees.fullName,
        })
        .from(users)
        .leftJoin(employees, or(eq(users.id, employees.userId), eq(users.employeeId, employees.id)))
        .where(inArray(users.id, partnerIds));

        for (const d of details) {
          partnerDetailsMap.set(d.userId, {
            email: d.email,
            name: d.name,
            role: d.role,
          });
        }
      }

      const conversations = Array.from(partnerMap.values()).map((conv) => {
        const details = partnerDetailsMap.get(conv.partnerId);
        return {
          ...conv,
          partnerEmail: details?.email || null,
          partnerName: details?.name || null,
          partnerRole: details?.role || null,
        };
      });

      return reply.send({ success: true, data: conversations });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 3. Get directory contacts for starting new 1-on-1 chats
  app.get('/contacts', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const query = (request.query as { search?: string }) || {};
      const search = query.search ? query.search.trim().toLowerCase() : '';

      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        role: users.role,
        employeeId: employees.id,
        nip: employees.nip,
        fullName: employees.fullName,
        departmentName: departments.name,
        positionName: positions.name,
        avatarUrl: employees.photoUrl,
      })
      .from(users)
      .leftJoin(employees, or(eq(users.id, employees.userId), eq(users.employeeId, employees.id)))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(positions, eq(employees.positionId, positions.id))
      .where(and(
        ne(users.id, user.id),
        eq(users.isActive, true)
      ))
      .orderBy(asc(employees.fullName), asc(users.email));

      const contactMap = new Map<string, {
        userId: string;
        name: string;
        email: string;
        role: string;
        nip: string | null;
        department: string | null;
        position: string | null;
        avatarUrl: string | null;
      }>();

      for (const u of allUsers) {
        if (!contactMap.has(u.id)) {
          contactMap.set(u.id, {
            userId: u.id,
            name: u.fullName || u.email.split('@')[0],
            email: u.email,
            role: u.role,
            nip: u.nip || null,
            department: u.departmentName || null,
            position: u.positionName || null,
            avatarUrl: u.avatarUrl || null,
          });
        }
      }

      let contacts = Array.from(contactMap.values());
      if (search) {
        contacts = contacts.filter((c) =>
          c.name.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          (c.nip && c.nip.toLowerCase().includes(search)) ||
          (c.department && c.department.toLowerCase().includes(search)) ||
          (c.position && c.position.toLowerCase().includes(search))
        );
      }

      return reply.send({ success: true, data: contacts });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 4. Get conversation history with specific user (and mark incoming unread messages as read)
  app.get('/:userId', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { userId } = request.params as { userId: string };

      // Validate UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        return reply.status(400).send({ success: false, error: 'Invalid user ID format' });
      }

      const conversation = await db.select()
        .from(messages)
        .where(or(
          and(
            eq(messages.senderId, user.id),
            eq(messages.receiverId, userId)
          ),
          and(
            eq(messages.senderId, userId),
            eq(messages.receiverId, user.id)
          )
        ))
        .orderBy(asc(messages.createdAt));

      // Mark unread messages sent by the other user to current user as read
      await db.update(messages)
        .set({ isRead: true })
        .where(and(
          eq(messages.senderId, userId),
          eq(messages.receiverId, user.id),
          eq(messages.isRead, false)
        ));

      return reply.send({ success: true, data: conversation });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 4. Mark specific message as read
  app.put('/:messageId/read', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { messageId } = request.params as { messageId: string };

      const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
      if (!msg) {
        return reply.status(404).send({ success: false, error: 'Message not found' });
      }

      // Security check: Only the recipient can mark a message as read
      if (msg.receiverId !== user.id) {
        return reply.status(403).send({ success: false, error: 'Forbidden: Only the recipient can mark message as read' });
      }

      const [updated] = await db.update(messages)
        .set({ isRead: true })
        .where(eq(messages.id, messageId))
        .returning();

      return reply.send({ success: true, data: updated });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
