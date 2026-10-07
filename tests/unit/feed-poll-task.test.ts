// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as schema from '../../server/db/schema'

let client: ReturnType<typeof createClient>
let db: ReturnType<typeof drizzle<typeof schema>>
let task: { run: () => Promise<unknown> }
const url = 'https://example.com/rss'
const xml = '<rss><channel><item><guid>one</guid><title>One</title></item></channel></rss>'
const now = new Date('2026-10-07T10:00:00Z')

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  client = createClient({ url: ':memory:' })
  for (const file of readdirSync('server/db/migrations/sqlite').filter(f => f.endsWith('.sql')).sort()) {
    await client.executeMultiple(readFileSync(`server/db/migrations/sqlite/${file}`, 'utf8'))
  }
  db = drizzle(client, { schema })
  vi.stubGlobal('db', db)
  vi.stubGlobal('schema', schema)
  vi.stubGlobal('defineTask', (t: unknown) => t)
  vi.stubGlobal('getPostOptions', () => ({ maxCharacters: 300 }))
  vi.stubGlobal('postToBluesky', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(xml, { headers: { etag: '"v1"' } })))
  task = (await import('../../server/tasks/feed/poll')).default
  const createdAt = new Date('2026-10-06T10:00:00Z')
  await db.insert(schema.targets).values({ id: 'target', userId: 'u', type: 'bluesky', name: 't', credentials: '{}', createdAt, updatedAt: createdAt })
  for (const id of ['a', 'b']) {
    await db.insert(schema.sources).values({ id, userId: 'u', name: id, url, createdAt, updatedAt: createdAt })
    await db.insert(schema.connections).values({ id, userId: 'u', sourceId: id, targetId: 'target', template: '{{title}}', createdAt, updatedAt: createdAt })
  }
})

afterEach(() => {
  client.close()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('fetches identical URLs once and persists shared validators and cached items', async () => {
  await task.run()
  expect(fetch).toHaveBeenCalledTimes(1)
  const rows = await client.execute('SELECT * FROM feed_poll_state')
  expect(rows.rows).toHaveLength(1)
  expect(rows.rows[0]).toMatchObject({ url, etag: '"v1"', failures: 0, next_poll_at: null })
  expect(JSON.parse(rows.rows[0]!.items as string)[0].guid).toBe('one')
  expect(postToBluesky).toHaveBeenCalledTimes(2)
})

it('persists backoff, skips early runs, and fetches at the retry boundary', async () => {
  vi.mocked(fetch).mockRejectedValue(new Error('offline'))
  await task.run()
  vi.setSystemTime(new Date(now.getTime() + 299_000))
  await task.run()
  expect(fetch).toHaveBeenCalledTimes(1)
  vi.setSystemTime(new Date(now.getTime() + 300_000))
  await task.run()
  expect(fetch).toHaveBeenCalledTimes(2)
  const result = await client.execute('SELECT failures, next_poll_at FROM feed_poll_state')
  expect(result.rows[0]).toMatchObject({ failures: 2, next_poll_at: now.getTime() / 1000 + 900 })
})

it('honors rate limits without blocking other feed URLs', async () => {
  await client.execute("UPDATE source SET url = 'https://other.example/rss' WHERE id = 'b'")
  vi.mocked(fetch).mockImplementation(async (input) => input === url
    ? new Response(null, { status: 429, headers: { 'retry-after': '1800' } })
    : new Response(xml))
  await task.run()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(postToBluesky).toHaveBeenCalledTimes(1)
  const result = await client.execute({ sql: 'SELECT next_poll_at FROM feed_poll_state WHERE url = ?', args: [url] })
  expect(result.rows[0]!.next_poll_at).toBe(now.getTime() / 1000 + 1800)
})

it('uses cached items on 304 to retry failed posts and resets feed failures', async () => {
  vi.mocked(postToBluesky).mockRejectedValue(new Error('posting unavailable'))
  await task.run()
  await client.execute('UPDATE feed_poll_state SET failures = 2')
  vi.mocked(postToBluesky).mockResolvedValue(undefined)
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 304 }))
  vi.setSystemTime(new Date(now.getTime() + 300_000))
  await task.run()
  expect(vi.mocked(fetch).mock.calls[1]![1]!.headers).toMatchObject({ 'If-None-Match': '"v1"' })
  expect(postToBluesky).toHaveBeenCalledTimes(4)
  const result = await client.execute('SELECT failures, etag FROM feed_poll_state')
  expect(result.rows[0]).toMatchObject({ failures: 0, etag: '"v1"' })
  expect((await db.select().from(schema.postLogs)).map(l => l.status)).toEqual(['posted', 'posted'])
})

it('retains valid cache on parse failure and resets backoff after recovery', async () => {
  await task.run()
  const cached = (await client.execute('SELECT items FROM feed_poll_state')).rows[0]!.items
  vi.mocked(fetch).mockResolvedValue(new Response('not a feed', { headers: { etag: '"broken"' } }))
  await task.run()
  const failed = await client.execute('SELECT items, etag, failures FROM feed_poll_state')
  expect(failed.rows[0]).toMatchObject({ items: cached, etag: '"v1"', failures: 1 })
  vi.setSystemTime(new Date(now.getTime() + 300_000))
  vi.mocked(fetch).mockResolvedValue(new Response(xml.replace('one', 'two'), { headers: { etag: '"v2"' } }))
  await task.run()
  const recovered = await client.execute('SELECT items, etag, failures, next_poll_at FROM feed_poll_state')
  expect(recovered.rows[0]).toMatchObject({ etag: '"v2"', failures: 0, next_poll_at: null })
  expect(JSON.parse(recovered.rows[0]!.items as string)[0].guid).toBe('two')
  expect(postToBluesky).toHaveBeenCalledTimes(4)
})
