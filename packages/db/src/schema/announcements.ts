import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  priority: varchar('priority', { length: 20 }).default('normal'),
  attachmentUrl: text('attachment_url'),
  createdBy: uuid('created_by').references(() => users.id),
  targetAudience: varchar('target_audience', { length: 20 }).default('all'),
  targetId: uuid('target_id'),
  isPublished: boolean('is_published').default(false),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
