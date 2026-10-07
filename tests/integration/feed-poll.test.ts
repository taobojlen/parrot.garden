// @vitest-environment node
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '../../server/db/schema'
import { fetchAndParseFeed } from '../../server/utils/rss'
import { getPostOptions } from '../../server/utils/target'
import { postToMastodon } from '../../server/utils/mastodon'
import { processConnectionItems } from '../../server/utils/poll'

const NOW = new Date('2026-04-16T12:00:00Z')
const CREATED = new Date('2026-04-16T11:00:00Z')
const FEED_URL = 'https://blog.example/feed.xml'
const LINK = 'https://blog.example/a-long-permalink-for-the-post'
const IMAGE = 'https://blog.example/parrot.png'
const TITLE = '👨‍👩‍👧‍👦'.repeat(50)
const FEED = `<rss version="2.0"><channel><title>Blog</title><item>
  <guid>new</guid><title>${TITLE}</title><link>${LINK}</link>
  <description><![CDATA[<p>Hello &amp; goodbye</p><img src="${IMAGE}" alt="Green parrot">]]></description>
  <author>Alice</author><pubDate>Thu, 16 Apr 2026 10:00:00 GMT</pubDate>
</item></channel></rss>`

let client: ReturnType<typeof createClient>
let db: ReturnType<typeof drizzle<typeof schema>>
let task: { run: () => Promise<{ result: string }> }
let statusCode: number
let requests: { url: string; init?: RequestInit }[]

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('NUXT_MAX_CHARACTERS_OVERRIDE', '')
  client = createClient({ url: ':memory:' })
  db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: 'server/db/migrations/sqlite' })
  await client.execute('PRAGMA foreign_keys = ON')
  await db.insert(schema.sources).values({
    id: 'source', userId: 'user', name: 'Blog', url: FEED_URL, createdAt: CREATED, updatedAt: CREATED,
  })
  await db.insert(schema.targets).values({
    id: 'target', userId: 'user', name: 'Mastodon', type: 'mastodon',
    credentials: JSON.stringify({ instanceUrl: 'social.example', accessToken: 'test-token', maxCharacters: 40 }),
    createdAt: CREATED, updatedAt: CREATED,
  })
  await db.insert(schema.connections).values({
    id: 'connection', userId: 'user', sourceId: 'source', targetId: 'target',
    template: '{{title}}', truncateWithLink: true, includeImages: true,
    createdAt: CREATED, updatedAt: CREATED,
  })
  vi.stubGlobal('db', db)
  vi.stubGlobal('schema', schema)
  vi.stubGlobal('defineTask', (definition: unknown) => definition)
  vi.stubGlobal('getPostOptions', getPostOptions)
  vi.stubGlobal('postToMastodon', postToMastodon)
  task = (await import('../../server/tasks/feed/poll')).default
  requests = []
  statusCode = 200
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    requests.push({ url, init })
    if (url === FEED_URL) {
      return new Headers(init?.headers).get('If-None-Match') === '"feed-v1"'
        ? new Response(null, { status: 304 })
        : new Response(FEED, { headers: { etag: '"feed-v1"' } })
    }
    if (url === IMAGE) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
    if (url === 'https://social.example/api/v1/media') return Response.json({ id: 'media-1' })
    if (url === 'https://social.example/api/v1/statuses') {
      return statusCode === 200 ? Response.json({ id: 'post-1' }) : new Response('Unavailable', { status: statusCode })
    }
    throw new Error(`Unexpected HTTP request: ${url}`)
  })
})

afterEach(() => {
  client?.close()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function statuses() {
  return requests.filter(request => request.url.endsWith('/api/v1/statuses'))
}

describe('feed:poll', () => {
  it('publishes parsed, truncated text and images, persists the log, and does not repost', async () => {
    expect(await task.run()).toEqual({ result: 'Posted: 1, Failed: 0, Skipped: 0' })
    expect(statuses()).toHaveLength(1)
    expect(statuses()[0]!.init).toMatchObject({
      method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    })
    expect(JSON.parse(statuses()[0]!.init!.body as string)).toEqual({
      status: `${'👨‍👩‍👧‍👦'.repeat(16)}…${LINK}`, media_ids: ['media-1'],
    })
    const upload = requests.find(request => request.url.endsWith('/api/v1/media'))!
    const form = upload.init!.body as FormData
    expect(form.get('description')).toBe('Green parrot')
    const file = form.get('file') as File
    expect(file.type).toBe('image/png')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    expect(await db.select().from(schema.postLogs)).toEqual([expect.objectContaining({
      connectionId: 'connection', itemGuid: 'new', itemTitle: TITLE, itemLink: LINK,
      itemDescription: 'Hello & goodbye', itemAuthor: 'Alice', status: 'posted', attempts: 1,
      error: null, firstFailedAt: null, nextRetryAt: null,
    })])
    expect(await task.run()).toEqual({ result: 'Posted: 0, Failed: 0, Skipped: 1' })
    expect(statuses()).toHaveLength(1)
    const feedRequests = requests.filter(request => request.url === FEED_URL)
    expect(feedRequests).toHaveLength(2)
    expect(new Headers(feedRequests[1]!.init!.headers).get('If-None-Match')).toBe('"feed-v1"')
    expect(await db.select().from(schema.sourceItems)).toEqual([expect.objectContaining({
      itemGuid: 'new', createdAt: NOW,
    })])
  })

  it.each([CREATED, new Date(CREATED.getTime() - 1000)])('does not publish items first seen at %s', async (firstSeen) => {
    await db.insert(schema.sourceItems).values({ id: 'seen', sourceId: 'source', itemGuid: 'new', createdAt: firstSeen })
    expect(await task.run()).toEqual({ result: 'Posted: 0, Failed: 0, Skipped: 0' })
    expect(statuses()).toEqual([])
    expect(await db.select().from(schema.postLogs)).toEqual([])
    expect((await db.select().from(schema.sourceItems))[0]!.createdAt).toEqual(firstSeen)
  })

  it('retries a transient failure only when due and clears the persisted error after recovery', async () => {
    statusCode = 503
    expect(await task.run()).toEqual({ result: 'Posted: 0, Failed: 1, Skipped: 0' })
    const [failed] = await db.select().from(schema.postLogs)
    expect(failed).toMatchObject({
      status: 'failed', attempts: 1, error: 'Mastodon API error: 503 Unavailable',
      firstFailedAt: NOW, nextRetryAt: new Date('2026-04-16T12:05:00Z'),
    })
    vi.setSystemTime(new Date('2026-04-16T12:04:59Z'))
    expect(await task.run()).toEqual({ result: 'Posted: 0, Failed: 0, Skipped: 1' })
    expect(statuses()).toHaveLength(1)
    vi.setSystemTime(new Date('2026-04-16T12:05:00Z'))
    expect(await task.run()).toEqual({ result: 'Posted: 0, Failed: 1, Skipped: 0' })
    expect((await db.select().from(schema.postLogs))[0]).toMatchObject({
      id: failed!.id, attempts: 2, firstFailedAt: NOW, nextRetryAt: new Date('2026-04-16T12:15:00Z'),
    })
    statusCode = 200
    vi.setSystemTime(new Date('2026-04-16T12:15:00Z'))
    expect(await task.run()).toEqual({ result: 'Posted: 1, Failed: 0, Skipped: 0' })
    expect(await db.select().from(schema.postLogs)).toEqual([expect.objectContaining({
      id: failed!.id, status: 'posted', error: null, firstFailedAt: null, nextRetryAt: null,
    })])
    expect(statuses()).toHaveLength(3)
  })

  it.each([400, 401])('does not retry a permanent HTTP %i failure', async (code) => {
    statusCode = code
    expect(await task.run()).toEqual({ result: 'Posted: 0, Failed: 1, Skipped: 0' })
    expect((await db.select().from(schema.postLogs))[0]).toMatchObject({ status: 'failed', nextRetryAt: null })
    statusCode = 200
    vi.setSystemTime(new Date('2026-04-17T12:00:00Z'))
    expect(await task.run()).toEqual({ result: 'Posted: 0, Failed: 0, Skipped: 1' })
    expect(statuses()).toHaveLength(1)
  })

  it('publishes each enabled connection independently without downloading a shared feed twice', async () => {
    await db.insert(schema.connections).values([
      { id: 'second', userId: 'user', sourceId: 'source', targetId: 'target', template: '{{author}}: {{description}}', createdAt: CREATED, updatedAt: CREATED },
      { id: 'disabled', userId: 'user', sourceId: 'source', targetId: 'target', template: 'Do not post', enabled: false, createdAt: CREATED, updatedAt: CREATED },
    ])
    expect(await task.run()).toEqual({ result: 'Posted: 2, Failed: 0, Skipped: 0' })
    expect(statuses().map(request => JSON.parse(request.init!.body as string))).toEqual(expect.arrayContaining([
      { status: 'Alice: Hello & goodbye' },
      { status: `${'👨‍👩‍👧‍👦'.repeat(16)}…${LINK}`, media_ids: ['media-1'] },
    ]))
    expect(requests.filter(request => request.url === FEED_URL)).toHaveLength(1)
    expect((await db.select().from(schema.postLogs)).map(log => log.connectionId).sort()).toEqual(['connection', 'second'])
  })

  it('uses the database unique constraint to reject a duplicate claim from a stale poll', async () => {
    await task.run()
    const items = await fetchAndParseFeed(FEED_URL)
    const result = await processConnectionItems({
      items, existingLogs: new Map(), connectionId: 'connection', template: '{{title}}', includeImages: false,
      target: { type: 'mastodon', credentials: '{"instanceUrl":"social.example","accessToken":"test-token"}' },
      maxCharacters: 40,
      postFn: async (credentials, text, images) => { await postToMastodon(credentials, text, images) },
      claimFn: async (row) => {
        try {
          await db.insert(schema.postLogs).values(row)
          return true
        } catch {
          return false
        }
      },
    })
    expect(result).toEqual({ posted: 0, failed: 0, skipped: 1, newRows: [], updates: [] })
    expect(statuses()).toHaveLength(1)
    expect(await db.select().from(schema.postLogs)).toHaveLength(1)
  })

  it('does not fetch or publish when every connection is disabled', async () => {
    await db.update(schema.connections).set({ enabled: false }).where(eq(schema.connections.id, 'connection'))
    expect(await task.run()).toEqual({ result: 'No active connections' })
    expect(requests).toEqual([])
  })
})
