import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, socialPosts, socialComments, socialLikes, users, employees, eq, desc, asc, and, sql } from '@payrollpro/db';

const postSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000, 'Content cannot exceed 5000 characters'),
  attachmentUrl: z.string().optional(),
  postType: z.enum(['feed', 'forum', 'poll']).default('feed'),
  forumCategory: z.string().max(50).optional(),
});

const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment cannot exceed 1000 characters'),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  postType: z.enum(['feed', 'forum', 'poll']).optional(),
  category: z.string().optional(),
});

export async function postRoutes(app: FastifyInstance) {
  // 1. Get feed & forum posts (with pagination and author info)
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = querySchema.parse(request.query);
      const offset = (query.page - 1) * query.limit;

      const conditions = [];
      if (query.postType) {
        conditions.push(eq(socialPosts.postType, query.postType));
      }
      if (query.category) {
        conditions.push(eq(socialPosts.forumCategory, query.category));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const posts = await db.select({
        id: socialPosts.id,
        userId: socialPosts.userId,
        content: socialPosts.content,
        attachmentUrl: socialPosts.attachmentUrl,
        postType: socialPosts.postType,
        forumCategory: socialPosts.forumCategory,
        likesCount: socialPosts.likesCount,
        commentsCount: socialPosts.commentsCount,
        createdAt: socialPosts.createdAt,
        updatedAt: socialPosts.updatedAt,
        authorEmail: users.email,
        authorRole: users.role,
        authorName: employees.fullName,
      })
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.userId, users.id))
      .leftJoin(employees, eq(users.id, employees.userId))
      .where(whereClause)
      .orderBy(desc(socialPosts.createdAt))
      .limit(query.limit)
      .offset(offset);

      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(socialPosts)
        .where(whereClause);

      const total = Number(countResult?.count || 0);

      return reply.send({
        success: true,
        data: posts,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit) || 1,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 2. Create post
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const body = postSchema.parse(request.body);

      const newPost = await db.insert(socialPosts).values({
        userId: user.id,
        content: body.content,
        attachmentUrl: body.attachmentUrl || null,
        postType: body.postType,
        forumCategory: body.forumCategory || null,
        likesCount: 0,
        commentsCount: 0,
      }).returning();

      return reply.status(201).send({ success: true, data: newPost[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 3. Get single post by ID
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };

      const [post] = await db.select({
        id: socialPosts.id,
        userId: socialPosts.userId,
        content: socialPosts.content,
        attachmentUrl: socialPosts.attachmentUrl,
        postType: socialPosts.postType,
        forumCategory: socialPosts.forumCategory,
        likesCount: socialPosts.likesCount,
        commentsCount: socialPosts.commentsCount,
        createdAt: socialPosts.createdAt,
        updatedAt: socialPosts.updatedAt,
        authorEmail: users.email,
        authorRole: users.role,
        authorName: employees.fullName,
      })
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.userId, users.id))
      .leftJoin(employees, eq(users.id, employees.userId))
      .where(eq(socialPosts.id, id))
      .limit(1);

      if (!post) {
        return reply.status(404).send({ success: false, error: 'Post not found' });
      }

      // Check if current user liked the post
      const [liked] = await db.select({ id: socialLikes.id })
        .from(socialLikes)
        .where(and(
          eq(socialLikes.postId, id),
          eq(socialLikes.userId, user.id)
        ))
        .limit(1);

      return reply.send({
        success: true,
        data: {
          ...post,
          isLikedByMe: !!liked,
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 4. Delete post (Owner or Admin only)
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };

      const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
      if (!post) {
        return reply.status(404).send({ success: false, error: 'Post not found' });
      }

      // Security check: Only post owner or super_admin / hr_admin can delete
      if (post.userId !== user.id && !['super_admin', 'hr_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: You are not authorized to delete this post' });
      }

      // Clean up likes and comments first
      await db.delete(socialLikes).where(eq(socialLikes.postId, id));
      await db.delete(socialComments).where(eq(socialComments.postId, id));
      await db.delete(socialPosts).where(eq(socialPosts.id, id));

      return reply.send({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 5. Like / Unlike post toggle (Atomic SQL & Transaction)
  app.post('/:id/like', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };

      const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
      if (!post) {
        return reply.status(404).send({ success: false, error: 'Post not found' });
      }

      let liked = false;
      let newLikesCount = 0;

      await db.transaction(async (tx) => {
        const [existingLike] = await tx.select()
          .from(socialLikes)
          .where(and(
            eq(socialLikes.postId, id),
            eq(socialLikes.userId, user.id)
          ))
          .limit(1);

        if (existingLike) {
          // Unlike
          await tx.delete(socialLikes).where(eq(socialLikes.id, existingLike.id));
          const [updated] = await tx.update(socialPosts)
            .set({ likesCount: sql`GREATEST(0, ${socialPosts.likesCount} - 1)` })
            .where(eq(socialPosts.id, id))
            .returning({ likesCount: socialPosts.likesCount });
          liked = false;
          newLikesCount = updated.likesCount ?? 0;
        } else {
          // Like
          await tx.insert(socialLikes).values({ postId: id, userId: user.id });
          const [updated] = await tx.update(socialPosts)
            .set({ likesCount: sql`${socialPosts.likesCount} + 1` })
            .where(eq(socialPosts.id, id))
            .returning({ likesCount: socialPosts.likesCount });
          liked = true;
          newLikesCount = updated.likesCount ?? 0;
        }
      });

      return reply.send({
        success: true,
        data: { liked, likesCount: newLikesCount },
        message: liked ? 'Post liked' : 'Post unliked',
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 6. Get comments for post
  app.get('/:id/comments', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const [post] = await db.select({ id: socialPosts.id }).from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
      if (!post) {
        return reply.status(404).send({ success: false, error: 'Post not found' });
      }

      const comments = await db.select({
        id: socialComments.id,
        postId: socialComments.postId,
        userId: socialComments.userId,
        content: socialComments.content,
        createdAt: socialComments.createdAt,
        authorEmail: users.email,
        authorRole: users.role,
        authorName: employees.fullName,
      })
      .from(socialComments)
      .leftJoin(users, eq(socialComments.userId, users.id))
      .leftJoin(employees, eq(users.id, employees.userId))
      .where(eq(socialComments.postId, id))
      .orderBy(asc(socialComments.createdAt));

      return reply.send({ success: true, data: comments });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 7. Add comment to post (Atomic comment counter)
  app.post('/:id/comments', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { id } = request.params as { id: string };
      const body = commentSchema.parse(request.body);

      const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
      if (!post) {
        return reply.status(404).send({ success: false, error: 'Post not found' });
      }

      let newComment: any;
      await db.transaction(async (tx) => {
        const [created] = await tx.insert(socialComments).values({
          postId: id,
          userId: user.id,
          content: body.content,
        }).returning();
        newComment = created;

        await tx.update(socialPosts)
          .set({ commentsCount: sql`${socialPosts.commentsCount} + 1` })
          .where(eq(socialPosts.id, id));
      });

      return reply.status(201).send({ success: true, data: newComment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ success: false, error: 'Validation error', details: error.errors });
      }
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // 8. Delete comment (Owner or Admin only, Atomic comment counter)
  app.delete('/comments/:commentId', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      const { commentId } = request.params as { commentId: string };

      const [comment] = await db.select().from(socialComments).where(eq(socialComments.id, commentId)).limit(1);
      if (!comment) {
        return reply.status(404).send({ success: false, error: 'Comment not found' });
      }

      // Security check: Only comment owner or super_admin / hr_admin can delete
      if (comment.userId !== user.id && !['super_admin', 'hr_admin'].includes(user.role)) {
        return reply.status(403).send({ success: false, error: 'Forbidden: You are not authorized to delete this comment' });
      }

      await db.transaction(async (tx) => {
        await tx.delete(socialComments).where(eq(socialComments.id, commentId));

        if (comment.postId) {
          await tx.update(socialPosts)
            .set({ commentsCount: sql`GREATEST(0, ${socialPosts.commentsCount} - 1)` })
            .where(eq(socialPosts.id, comment.postId));
        }
      });

      return reply.send({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}
