// @vitest-environment node
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as schema from '../../server/db/schema'
import { fetchAndParseFeed } from '../../server/utils/rss'
import { postToBluesky } from '../../server/utils/bluesky'
import { postToMastodon } from '../../server/utils/mastodon'
import { getPostOptions } from '../../server/utils/target'
import { renderTemplate, truncatePost } from '../../server/utils/template'
import { requireAuth } from '../../server/utils/require-auth'

const FEED = 'https://btao.org/notes/feed.xml'
const GUID = 'https://btao.org/notes/oKcj21FbYi9r_HRs76Tbb/'
const PHOTO = 'https://images.btao.org/note-images/oKcj21FbYi9r_HRs76Tbb/img_3828.webp'
const TEXT = 'i bought this copy of accelerando for £3 in a charity shop, and it turns out it’s a signed copy!'
const ALT = 'photo of the title page of a book: accelerando by charles stross, with his signature'
const XML = `<rss><channel><item><guid>another-item</guid><description><![CDATA[<img src="https://example.com/wrong.jpg">]]></description></item><item><guid>${GUID}</guid><description><![CDATA[<img src="${PHOTO}" alt="${ALT}">]]></description></item></channel></rss>`
const PDS = 'https://pds.example'
const CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'
const { env } = vi.hoisted(() => ({ env: {} as typeof import('cloudflare:workers').env }))
vi.mock('cloudflare:workers', () => ({ env }))

let client: ReturnType<typeof createClient>
let db: ReturnType<typeof drizzle<typeof schema>>
let retry: (event: { headers: Headers; id: string }) => Promise<unknown>
let requests: Request[]
let feedResponse: () => Response
const event = (user = 'user') => ({ headers: new Headers({ 'x-test-user': user }), id: 'failed-post' })

beforeEach(async () => {
  client = createClient({ url: ':memory:' })
  db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: 'server/db/migrations/sqlite' })
  await client.execute('PRAGMA foreign_keys = ON')
  const now = new Date()
  await db.insert(schema.sources).values({ id: 'source', userId: 'user', name: 'Notes', url: FEED, createdAt: now, updatedAt: now })
  await db.insert(schema.targets).values({ id: 'target', userId: 'user', name: 'Bluesky', type: 'bluesky', credentials: JSON.stringify({ handle: 'btao.org', appPassword: 'test', maxCharacters: 300 }), createdAt: now, updatedAt: now })
  await db.insert(schema.connections).values({ id: 'connection', userId: 'user', sourceId: 'source', targetId: 'target', template: '{{content}}', includeImages: true, createdAt: now, updatedAt: now })
  await db.insert(schema.postLogs).values({ id: 'failed-post', connectionId: 'connection', itemGuid: GUID, itemContent: TEXT, status: 'failed', attempts: 1, error: 'BlobTooLarge', firstFailedAt: now, nextRetryAt: null, updatedAt: now })
  for (const [name, value] of Object.entries({ db, schema, fetchAndParseFeed, postToBluesky, postToMastodon, getPostOptions, renderTemplate, truncatePost, requireAuth })) vi.stubGlobal(name, value)
  vi.stubGlobal('eventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRouterParam', (e: { id: string }) => e.id)
  vi.stubGlobal('createError', (options: object) => Object.assign(new Error(), options))
  vi.stubGlobal('serverAuth', () => ({ api: { getSession: async ({ headers }: { headers: Headers }) => ({ user: { id: headers.get('x-test-user') } }) } }))
  env.IMAGES = { input: () => ({ transform: () => ({ output: async () => ({ response: () => new Response(new Uint8Array([4, 5, 6])) }) }) }) }
  requests = []
  feedResponse = () => new Response(XML)
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    if (request.url === FEED) return feedResponse()
    if (request.url === PHOTO) return new Response(new Uint8Array(2_642_880), { headers: { 'content-type': 'image/webp' } })
    if (request.url.includes('/com.atproto.identity.resolveHandle?')) return Response.json({ did: 'did:plc:test' })
    if (request.url === 'https://plc.directory/did:plc:test') return Response.json({ service: [{ id: '#atproto_pds', serviceEndpoint: PDS }] })
    if (request.url.endsWith('/com.atproto.server.createSession')) return Response.json({ did: 'did:plc:test', handle: 'btao.org', accessJwt: 'test', refreshJwt: 'test' })
    if (request.url.endsWith('/com.atproto.repo.uploadBlob')) return Response.json({ blob: { $type: 'blob', ref: { $link: CID }, mimeType: 'image/webp', size: 3 } })
    if (request.url.endsWith('/com.atproto.repo.createRecord')) return Response.json({ uri: 'at://did:plc:test/app.bsky.feed.post/1', cid: CID })
    if (request.url === 'https://social.example/api/v1/media') return Response.json({ id: 'media-1' })
    if (request.url === 'https://social.example/api/v1/statuses') return Response.json({ id: 'post-1' })
    throw new Error(`Unexpected request: ${request.url}`)
  })
  retry = (await import('../../server/api/post-log/[id]/retry.post')).default as unknown as typeof retry
})

afterEach(() => {
  client.close()
  vi.unstubAllGlobals()
})

it('retries the matching feed item with a resized image and alt text, then persists success', async () => {
  expect(await retry(event())).toEqual({ ok: true, status: 'posted' })
  const posts = requests.filter(r => r.url.endsWith('/com.atproto.repo.createRecord'))
  expect(posts).toHaveLength(1)
  expect((await posts[0]!.json()).record).toMatchObject({ text: TEXT, embed: { $type: 'app.bsky.embed.images', images: [{ alt: ALT, image: { mimeType: 'image/webp', size: 3 } }] } })
  const upload = requests.find(r => r.url.endsWith('/com.atproto.repo.uploadBlob'))!
  expect(new Uint8Array(await upload.arrayBuffer())).toEqual(new Uint8Array([4, 5, 6]))
  expect((await db.select().from(schema.postLogs))[0]).toMatchObject({ status: 'posted', error: null, nextRetryAt: null, firstFailedAt: null })
  await expect(retry(event())).rejects.toMatchObject({ statusCode: 404 })
  expect(requests.filter(r => r.url.endsWith('/com.atproto.repo.createRecord'))).toHaveLength(1)
})

it('does not fetch images or the feed when images are disabled', async () => {
  await db.update(schema.connections).set({ includeImages: false })
  await retry(event())
  const post = requests.find(r => r.url.endsWith('/com.atproto.repo.createRecord'))!
  expect((await post.json()).record.embed).toBeUndefined()
  expect(requests.some(r => r.url === FEED || r.url === PHOTO)).toBe(false)
})

it.each(['missing item', 'feed unavailable', 'resize unavailable'])('keeps the post failed instead of publishing without its image: %s', async (failure) => {
  if (failure === 'missing item') feedResponse = () => new Response('<rss><channel><item><guid>other</guid></item></channel></rss>')
  if (failure === 'feed unavailable') feedResponse = () => new Response('', { status: 503 })
  if (failure === 'resize unavailable') env.IMAGES = undefined
  await expect(retry(event())).rejects.toMatchObject({ statusCode: 502 })
  expect(requests.some(r => r.url.endsWith('/com.atproto.repo.createRecord'))).toBe(false)
  expect((await db.select().from(schema.postLogs))[0]).toMatchObject({ status: 'failed', attempts: 2, error: expect.any(String), nextRetryAt: expect.any(Date) })
})

it('rejects another user before fetching the feed or posting', async () => {
  await expect(retry(event('other'))).rejects.toMatchObject({ statusCode: 404 })
  expect(requests).toEqual([])
})

it('also preserves images when retrying a Mastodon post', async () => {
  await db.update(schema.targets).set({ type: 'mastodon', credentials: JSON.stringify({ instanceUrl: 'social.example', accessToken: 'test', maxCharacters: 500 }) }).where(eq(schema.targets.id, 'target'))
  await retry(event())
  const post = requests.find(r => r.url.endsWith('/api/v1/statuses'))!
  expect(await post.json()).toEqual({ status: TEXT, media_ids: ['media-1'] })
  const upload = requests.find(r => r.url.endsWith('/api/v1/media'))!
  expect((await upload.formData()).get('description')).toBe(ALT)
})
