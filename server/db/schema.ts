import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const sources = sqliteTable('source', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const targets = sqliteTable('target', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(), // 'bluesky', 'mastodon', etc.
  name: text('name').notNull(),
  credentials: text('credentials').notNull(), // JSON blob
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const connections = sqliteTable('connection', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  sourceId: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull().references(() => targets.id, { onDelete: 'cascade' }),
  template: text('template').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const postLogs = sqliteTable('post_log', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  itemGuid: text('item_guid').notNull(),
  itemTitle: text('item_title'),
  itemLink: text('item_link'),
  itemDescription: text('item_description'),
  itemAuthor: text('item_author'),
  itemPubDate: text('item_pub_date'),
  status: text('status').notNull(), // 'posted', 'failed', 'skipped'
  attempts: integer('attempts').notNull().default(0),
  error: text('error'),
  postedAt: integer('posted_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  uniqueIndex('connection_item_idx').on(table.connectionId, table.itemGuid),
])
