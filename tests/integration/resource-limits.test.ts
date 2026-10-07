// @vitest-environment node
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '../../server/db/schema'
import { fetchAndParseFeed } from '../../server/utils/rss'
import { verifyBlueskyCredentials } from '../../server/utils/bluesky'
import { exchangeMastodonToken, fetchInstanceConfig, normalizeInstanceUrl, registerMastodonApp } from '../../server/utils/mastodon'
import { requireAuth } from '../../server/utils/require-auth'
import { getBaseURL } from '../../server/utils/auth'

const FEED_URL = 'https://example.com/rss'
const DID = 'did:plc:testuser123'
const PDS = 'https://pds.example'
const now = new Date()
const resource = (id: string, userId = 'u') => ({
  id, userId, name: id, url: FEED_URL, type: 'bluesky', credentials: '{}', createdAt: now, updatedAt: now,
})
type Kind = 'source' | 'bluesky' | 'mastodon'
type TestEvent = { headers: Headers; body?: object; query?: object; id?: string }
type Handler = (event: TestEvent) => Promise<any>
let client: ReturnType<typeof createClient>
let db: ReturnType<typeof drizzle<typeof schema>>
let requests: Request[]
let onValidation: (() => Promise<void>) | undefined
let addSource: Handler
let addTarget: Handler
let authorize: Handler
let callback: Handler
let deleteSource: Handler
let deleteTarget: Handler

beforeEach(async () => {
  client = createClient({ url: ':memory:' })
  db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: 'server/db/migrations/sqlite' })
  await client.execute('PRAGMA foreign_keys = ON')
  requests = []
  onValidation = undefined
  vi.stubGlobal('db', db)
  vi.stubGlobal('schema', schema)
  // Supply Nitro's request primitives and the authenticated session boundary.
  vi.stubGlobal('eventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', (options: object) => Object.assign(new Error(), options))
  vi.stubGlobal('readBody', async (event: TestEvent) => event.body)
  vi.stubGlobal('getQuery', (event: TestEvent) => event.query)
  vi.stubGlobal('getRouterParam', (event: TestEvent) => event.id)
  vi.stubGlobal('sendRedirect', async (_event: TestEvent, url: string) => ({ redirect: url }))
  vi.stubGlobal('serverAuth', () => ({ api: { getSession: async ({ headers }: { headers: Headers }) => ({ user: { id: headers.get('x-test-user') } }) } }))
  vi.stubGlobal('requireAuth', requireAuth)
  vi.stubGlobal('fetchAndParseFeed', fetchAndParseFeed)
  vi.stubGlobal('verifyBlueskyCredentials', verifyBlueskyCredentials)
  vi.stubGlobal('normalizeInstanceUrl', normalizeInstanceUrl)
  vi.stubGlobal('registerMastodonApp', registerMastodonApp)
  vi.stubGlobal('exchangeMastodonToken', exchangeMastodonToken)
  vi.stubGlobal('fetchInstanceConfig', fetchInstanceConfig)
  vi.stubGlobal('useRuntimeConfig', () => ({ betterAuthUrl: 'https://parrot.garden' }))
  vi.stubGlobal('getBaseURL', getBaseURL)
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    if ([FEED_URL, `${PDS}/xrpc/com.atproto.server.createSession`, 'https://mastodon.social/api/v2/instance'].includes(request.url)) {
      await onValidation?.()
    }
    if (request.url === FEED_URL) return new Response('<rss><channel><item><guid>existing</guid><title>Existing post</title></item></channel></rss>')
    if (request.url.startsWith('https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?')) return Response.json({ did: DID })
    if (request.url === `https://plc.directory/${DID}`) return Response.json({ id: DID, service: [{ id: '#atproto_pds', serviceEndpoint: PDS }] })
    if (request.url === `${PDS}/xrpc/com.atproto.server.createSession`) return Response.json({ did: DID, handle: 'alice.example', accessJwt: 'test-token', refreshJwt: 'test-refresh', active: true })
    if (request.url === 'https://mastodon.social/api/v1/instance') return Response.json({})
    if (request.url === 'https://mastodon.social/api/v1/apps') return Response.json({ client_id: 'client', client_secret: 'test-secret' })
    if (request.url === 'https://mastodon.social/oauth/token') return Response.json({ access_token: 'test-token' })
    if (request.url === 'https://mastodon.social/api/v2/instance') return Response.json({ configuration: { statuses: { max_characters: 500 } } })
    throw new Error(`Unexpected HTTP request: ${request.method} ${request.url}`)
  })
  addSource = (await import('../../server/api/sources/index.post')).default as unknown as Handler
  addTarget = (await import('../../server/api/targets/index.post')).default as unknown as Handler
  authorize = (await import('../../server/api/targets/mastodon/authorize.post')).default as unknown as Handler
  callback = (await import('../../server/api/targets/mastodon/callback.get')).default as unknown as Handler
  deleteSource = (await import('../../server/api/sources/[id].delete')).default as unknown as Handler
  deleteTarget = (await import('../../server/api/targets/[id].delete')).default as unknown as Handler
})

afterEach(() => {
  client.close()
  vi.unstubAllGlobals()
})

function event(userId = 'u'): TestEvent {
  return { headers: new Headers({ 'x-test-user': userId }) }
}

async function mastodonCallbackEvent() {
  const { url } = await authorize({ ...event(), body: { instanceUrl: 'mastodon.social', targetName: 'new' } })
  return { ...event(), query: { code: 'code', state: new URL(url).searchParams.get('state') } }
}

async function create(kind: Kind, userId = 'u') {
  if (kind === 'source') return addSource({ ...event(userId), body: { name: 'new', url: FEED_URL } })
  if (kind === 'bluesky') return addTarget({ ...event(userId), body: { name: 'new', type: 'bluesky', credentials: { handle: 'alice.example', appPassword: 'test-password' } } })
  const result = await callback(await mastodonCallbackEvent())
  return { id: result.redirect.split('/').at(-1) }
}

describe.each(['source', 'bluesky', 'mastodon'] as const)('%s creation limits', (kind) => {
  const table = kind === 'source' ? schema.sources : schema.targets
  const label = kind === 'source' ? 'feeds' : 'destinations'

  it('allows the tenth, rejects the eleventh, and frees capacity through deletion', async () => {
    await db.insert(table).values(Array.from({ length: 9 }, (_, i) => resource(`seed-${i}`)))
    const created = await create(kind)
    const [stored] = await db.select().from(table).where(eq(table.id, created.id))
    expect(stored).toMatchObject({ userId: 'u', name: 'new', createdAt: expect.any(Date), updatedAt: expect.any(Date) })
    if (kind === 'source') {
      expect(stored).toMatchObject({ url: FEED_URL })
      expect(await db.select().from(schema.sourceItems)).toEqual([expect.objectContaining({ sourceId: created.id, itemGuid: 'existing' })])
    }
    else {
      expect(stored).toMatchObject({ type: kind })
      expect(JSON.parse((stored as typeof schema.targets.$inferSelect).credentials)).toEqual(kind === 'bluesky'
        ? { handle: 'alice.example', appPassword: 'test-password', maxCharacters: 300 }
        : { instanceUrl: 'mastodon.social', accessToken: 'test-token', maxCharacters: 500 })
    }
    requests = []
    await expect(create(kind)).rejects.toMatchObject({ statusCode: 409, statusMessage: `You can have up to 10 ${label}. Delete one before adding another.` })
    expect(requests).toEqual([])
    expect(await db.select().from(table)).toHaveLength(10)
    expect(await (kind === 'source' ? deleteSource : deleteTarget)({ ...event(), id: created.id })).toEqual({ ok: true })
    await create(kind)
    expect(await db.select().from(table)).toHaveLength(10)
  })

  it('keeps user and resource limits independent', async () => {
    await db.insert(schema.sources).values(Array.from({ length: 10 }, (_, i) => resource(`source-${i}`, 'other')))
    await db.insert(schema.targets).values(Array.from({ length: 10 }, (_, i) => resource(`target-${i}`, 'other')))
    const otherTable = kind === 'source' ? schema.targets : schema.sources
    await db.insert(otherTable).values(Array.from({ length: 10 }, (_, i) => resource(`own-${i}`)))
    const created = await create(kind)
    expect(await db.select().from(table).where(eq(table.id, created.id))).toEqual([expect.objectContaining({ userId: 'u' })])
  })

  it('rejects creation when the last slot is taken during external validation', async () => {
    await db.insert(table).values(Array.from({ length: 9 }, (_, i) => resource(`seed-${i}`)))
    // Start OAuth before another request takes the last slot.
    const callbackEvent = kind === 'mastodon' ? await mastodonCallbackEvent() : undefined
    onValidation = async () => { await db.insert(table).values(resource('competing-request')) }
    await expect(callbackEvent ? callback(callbackEvent) : create(kind)).rejects.toMatchObject({ statusCode: 409 })
    expect(await db.select().from(table)).toHaveLength(10)
    expect(await db.select().from(table).where(eq(table.id, 'competing-request'))).toHaveLength(1)
    expect(await db.select().from(schema.sourceItems)).toEqual([])
  })
})

it('rechecks capacity when an in-progress Mastodon authorization returns', async () => {
  await db.insert(schema.targets).values(Array.from({ length: 9 }, (_, i) => resource(`seed-${i}`)))
  const callbackEvent = await mastodonCallbackEvent()
  await db.insert(schema.targets).values(resource('tenth'))
  requests = []
  await expect(callback(callbackEvent)).rejects.toMatchObject({ statusCode: 409 })
  expect(requests).toEqual([])
  expect(await db.select().from(schema.targets)).toHaveLength(10)
})

it.each(['source', 'bluesky'] as const)('allows only one concurrent %s creation into the last slot', async (kind) => {
  const table = kind === 'source' ? schema.sources : schema.targets
  await db.insert(table).values(Array.from({ length: 9 }, (_, i) => resource(`seed-${i}`)))
  let arrived = 0
  let release: () => void
  const bothValidating = new Promise<void>((resolve) => { release = resolve })
  onValidation = async () => {
    if (++arrived === 2) release()
    await bothValidating
  }
  const results = await Promise.allSettled([create(kind), create(kind)])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { statusCode: 409 } })
  expect(await db.select().from(table)).toHaveLength(10)
})
