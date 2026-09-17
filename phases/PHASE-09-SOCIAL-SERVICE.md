# Phase 9: Social Service

**Objective:** Implementasi feed postingan, direct messaging, forum, dan pengumuman  
**Estimated Time:** 10-12 hours  
**Prerequisites:** Phase 8 selesai

---

## Tasks

### 9.1 Initialize Social Service

```bash
# Create social service
mkdir -p apps/social-service/src/{routes,services,middleware,utils}
cd apps/social-service

# package.json
cat > package.json << 'EOF'
{
  "name": "@payrollpro/social-service",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/jwt": "^8.0.0",
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.0",
    "ioredis": "^5.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
EOF

cp ../auth-service/tsconfig.json .
```

### 9.2 Create Social Posts Routes

```bash
# src/routes/posts.ts
cat > src/routes/posts.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { socialPosts, socialComments, socialLikes } from '@payrollpro/db';
import { eq, desc, and, sql } from 'drizzle-orm';

const postSchema = z.object({
  content: z.string().min(1).max(5000),
  attachmentUrl: z.string().optional(),
  postType: z.enum(['feed', 'forum', 'poll']).default('feed'),
  forumCategory: z.string().optional(),
});

const commentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export async function postRoutes(app: FastifyInstance) {
  // Get feed posts
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1, limit = 20, category } = request.query as any;
      const offset = (page - 1) * limit;
      
      let query = db.select().from(socialPosts);
      
      if (category) {
        query = query.where(eq(socialPosts.forumCategory, category));
      }
      
      const data = await query
        .orderBy(desc(socialPosts.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create post
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const body = postSchema.parse(request.body);

      const newPost = await db.insert(socialPosts).values({
        userId: user.id,
        content: body.content,
        attachmentUrl: body.attachmentUrl,
        postType: body.postType,
        forumCategory: body.forumCategory,
      }).returning();

      return reply.status(201).send({ success: true, data: newPost[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single post
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const post = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
      
      if (post.length === 0) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      return reply.send({ success: true, data: post[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete post
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: string };
      const { id } = request.params as { id: string };
      
      // Only owner or admin can delete
      const post = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
      
      if (post.length === 0) {
        return reply.status(404).send({ error: 'Post not found' });
      }

      if (post[0].userId !== user.id && !['super_admin', 'hr_admin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      await db.delete(socialLikes).where(eq(socialLikes.postId, id));
      await db.delete(socialComments).where(eq(socialComments.postId, id));
      await db.delete(socialPosts).where(eq(socialPosts.id, id));

      return reply.send({ success: true, message: 'Post deleted' });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Like post
  app.post('/:id/like', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const { id } = request.params as { id: string };

      // Check if already liked
      const existingLike = await db.select().from(socialLikes)
        .where(and(
          eq(socialLikes.postId, id),
          eq(socialLikes.userId, user.id)
        ))
        .limit(1);

      if (existingLike.length > 0) {
        // Unlike
        await db.delete(socialLikes).where(eq(socialLikes.id, existingLike[0].id));
        
        const post = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
        if (post.length > 0) {
          await db.update(socialPosts)
            .set({ likesCount: Math.max(0, post[0].likesCount - 1) })
            .where(eq(socialPosts.id, id));
        }

        return reply.send({ success: true, data: { liked: false } });
      }

      // Like
      await db.insert(socialLikes).values({ postId: id, userId: user.id });
      
      const post = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
      if (post.length > 0) {
        await db.update(socialPosts)
          .set({ likesCount: post[0].likesCount + 1 })
          .where(eq(socialPosts.id, id));
      }

      return reply.status(201).send({ success: true, data: { liked: true } });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get comments for post
  app.get('/:id/comments', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      const comments = await db.select().from(socialComments)
        .where(eq(socialComments.postId, id))
        .orderBy(desc(socialComments.createdAt));

      return reply.send({ success: true, data: comments });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Add comment to post
  app.post('/:id/comments', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const { id } = request.params as { id: string };
      const body = commentSchema.parse(request.body);

      const newComment = await db.insert(socialComments).values({
        postId: id,
        userId: user.id,
        content: body.content,
      }).returning();

      // Update comment count
      const post = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
      if (post.length > 0) {
        await db.update(socialPosts)
          .set({ commentsCount: post[0].commentsCount + 1 })
          .where(eq(socialPosts.id, id));
      }

      return reply.status(201).send({ success: true, data: newComment[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete comment
  app.delete('/comments/:commentId', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: string };
      const { commentId } = request.params as { commentId: string };
      
      const comment = await db.select().from(socialComments).where(eq(socialComments.id, commentId)).limit(1);
      
      if (comment.length === 0) {
        return reply.status(404).send({ error: 'Comment not found' });
      }

      if (comment[0].userId !== user.id && !['super_admin', 'hr_admin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      await db.delete(socialComments).where(eq(socialComments.id, commentId));

      return reply.send({ success: true, message: 'Comment deleted' });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 9.3 Create Messages Routes (DM)

```bash
# src/routes/messages.ts
cat > src/routes/messages.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { messages } from '@payrollpro/db';
import { eq, and, or, desc, sql } from 'drizzle-orm';

const messageSchema = z.object({
  receiverId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

export async function messageRoutes(app: FastifyInstance) {
  // Send message
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const body = messageSchema.parse(request.body);

      const newMessage = await db.insert(messages).values({
        senderId: user.id,
        receiverId: body.receiverId,
        content: body.content,
      }).returning();

      // TODO: Send real-time notification via WebSocket

      return reply.status(201).send({ success: true, data: newMessage[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get conversation with another user
  app.get('/:userId', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const { userId } = request.params as { userId: string };

      const conversation = await db.select().from(messages)
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
        .orderBy(desc(messages.createdAt));

      // Mark as read
      await db.update(messages)
        .set({ isRead: true })
        .where(and(
          eq(messages.senderId, userId),
          eq(messages.receiverId, user.id),
          eq(messages.isRead, false)
        ));

      return reply.send({ success: true, data: conversation });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get all conversations (list of users you've chatted with)
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };

      const conversations = await db.select({
        userId: sql<string>`CASE 
          WHEN ${messages.senderId} = ${user.id} THEN ${messages.receiverId}
          ELSE ${messages.senderId} END`,
        lastMessage: messages.content,
        lastMessageAt: messages.createdAt,
        unreadCount: sql<number>`SUM(CASE 
          WHEN ${messages.senderId} != ${user.id} AND ${messages.isRead} = false THEN 1 
          ELSE 0 END)`,
      })
      .from(messages)
      .where(or(
        eq(messages.senderId, user.id),
        eq(messages.receiverId, user.id)
      ))
      .groupBy(sql`1, 2, 3`)
      .orderBy(desc(messages.createdAt));

      return reply.send({ success: true, data: conversations });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Mark message as read
  app.put('/:messageId/read', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string };
      const { messageId } = request.params as { messageId: string };

      const updated = await db.update(messages)
        .set({ isRead: true })
        .where(and(
          eq(messages.id, messageId),
          eq(messages.receiverId, user.id)
        ))
        .returning();

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 9.4 Create Announcement Routes

```bash
# src/routes/announcements.ts
cat > src/routes/announcements.ts << 'EOF'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../utils/db';
import { announcements } from '@payrollpro/db';
import { eq, and, desc } from 'drizzle-orm';

const announcementSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  priority: z.enum(['normal', 'urgent']).default('normal'),
  attachmentUrl: z.string().optional(),
  targetAudience: z.enum(['all', 'department', 'location']).default('all'),
  targetId: z.string().uuid().optional(),
});

export async function announcementRoutes(app: FastifyInstance) {
  // Get all announcements
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await db.select().from(announcements)
        .where(eq(announcements.isPublished, true))
        .orderBy(desc(announcements.publishedAt));

      return reply.send({ success: true, data });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single announcement
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const announcement = await db.select().from(announcements)
        .where(eq(announcements.id, id)).limit(1);
      
      if (announcement.length === 0) {
        return reply.status(404).send({ error: 'Announcement not found' });
      }

      return reply.send({ success: true, data: announcement[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create announcement (HR/Admin only)
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: string };
      
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const body = announcementSchema.parse(request.body);

      const newAnnouncement = await db.insert(announcements).values({
        ...body,
        createdBy: user.id,
      }).returning();

      return reply.status(201).send({ success: true, data: newAnnouncement[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Publish announcement (HR/Admin only)
  app.put('/:id/publish', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: string };
      
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { id } = request.params as { id: string };

      const updated = await db.update(announcements)
        .set({
          isPublished: true,
          publishedAt: new Date(),
        })
        .where(eq(announcements.id, id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Announcement not found' });
      }

      // TODO: Send push notification to all employees

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update announcement
  app.put('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: string };
      
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { id } = request.params as { id: string };
      const body = announcementSchema.partial().parse(request.body);

      const updated = await db.update(announcements)
        .set(body)
        .where(eq(announcements.id, id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Announcement not found' });
      }

      return reply.send({ success: true, data: updated[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete announcement
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as { id: string; role: string };
      
      if (!['hr_admin', 'super_admin'].includes(user.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { id } = request.params as { id: string };
      const deleted = await db.delete(announcements).where(eq(announcements.id, id)).returning();

      if (deleted.length === 0) {
        return reply.status(404).send({ error: 'Announcement not found' });
      }

      return reply.send({ success: true, message: 'Announcement deleted' });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
EOF
```

### 9.5 Create Main Entry Point

```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { postRoutes } from './routes/posts';
import { messageRoutes } from './routes/messages';
import { announcementRoutes } from './routes/announcements';

const app = Fastify({ logger: true });

await app.register(cors, { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'super-secret-key' });

app.decorate('authenticate', async (request: any, reply: any) => {
  try { await request.jwtVerify(); } catch (err) { reply.status(401).send({ error: 'Unauthorized' }); }
});

await app.register(postRoutes, { prefix: '/api/posts' });
await app.register(messageRoutes, { prefix: '/api/messages' });
await app.register(announcementRoutes, { prefix: '/api/announcements' });

app.get('/health', async () => ({ status: 'ok', service: 'social-service' }));

const start = async () => {
  const port = parseInt(process.env.PORT || '3015');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Social service running on port ${port}`);
};

start();
EOF
```

### 9.6 Create Dockerfile

```bash
cat > Dockerfile << 'EOF'
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER fastify
EXPOSE 3015
CMD ["node", "dist/index.js"]
EOF
```

---

## Verification Checklist

- [x] Social service running on port 3015
- [x] Create post works
- [x] Like/unlike post works
- [x] Comment post works
- [x] Delete post works
- [x] Send DM works
- [x] Conversation list works
- [x] Mark message read works
- [x] Create announcement works
- [x] Publish announcement works

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | Get feed posts |
| POST | `/api/posts` | Create post |
| GET | `/api/posts/:id` | Get post detail |
| DELETE | `/api/posts/:id` | Delete post |
| POST | `/api/posts/:id/like` | Like/unlike post |
| GET | `/api/posts/:id/comments` | Get comments |
| POST | `/api/posts/:id/comments` | Add comment |
| POST | `/api/messages` | Send message |
| GET | `/api/messages` | Get conversations |
| GET | `/api/messages/:userId` | Get conversation |
| PUT | `/api/messages/:messageId/read` | Mark as read |
| GET | `/api/announcements` | Get announcements |
| POST | `/api/announcements` | Create announcement |
| PUT | `/api/announcements/:id/publish` | Publish announcement |
| PUT | `/api/announcements/:id` | Update announcement |
| DELETE | `/api/announcements/:id` | Delete announcement |

---

## Next Phase

Setelah Phase 9 selesai, lanjut ke:
**[Phase 10: API Gateway](./PHASE-10-API-GATEWAY.md)**