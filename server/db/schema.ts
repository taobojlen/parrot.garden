import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Better Auth tables
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

// App tables
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
  includeImages: integer('include_images', { mode: 'boolean' }).notNull().default(false),
  truncateWithLink: integer('truncate_with_link', { mode: 'boolean' }).notNull().default(false),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const sourceItems = sqliteTable('source_item', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  itemGuid: text('item_guid').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  uniqueIndex('source_item_guid_idx').on(table.sourceId, table.itemGuid),
])

export const postLogs = sqliteTable('post_log', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  itemGuid: text('item_guid').notNull(),
  itemTitle: text('item_title'),
  itemLink: text('item_link'),
  itemDescription: text('item_description'),
  itemContent: text('item_content'),
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

export const mastodonApps = sqliteTable('mastodon_app', {
  id: text('id').primaryKey(),
  instanceUrl: text('instance_url').notNull().unique(),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const mastodonOauthState = sqliteTable('mastodon_oauth_state', {
  id: text('id').primaryKey(),
  nonce: text('nonce').notNull().unique(),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
