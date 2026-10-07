// @vitest-environment node
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { postToBluesky, verifyBlueskyCredentials } from '../../server/utils/bluesky'
import { parseFeed } from '../../server/utils/rss'
import { renderTemplate, truncatePost } from '../../server/utils/template'

const PDS = 'https://pds.example'
const DID = 'did:plc:testuser123'
const PAGE = 'https://blog.example/post'
const PHOTO = 'https://blog.example/photo.png'
const credentials = { handle: 'alice.example', appPassword: 'test-password' }
const blob = { $type: 'blob', ref: { $link: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku' }, mimeType: 'image/png', size: 3 }
const postResult = { uri: `at://${DID}/app.bsky.feed.post/1`, cid: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku' }

let requests: Request[]
let pages: Map<string, () => Response>
let loginStatus: number
let postStatus: number
let did: string
let pdsServices: { id: string; type: string; serviceEndpoint: string }[]

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  requests = []
  pages = new Map()
  loginStatus = 200
  postStatus = 200
  did = DID
  pdsServices = [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }]
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    const url = new URL(request.url)
    if (url.hostname === 'public.api.bsky.app' && url.pathname.endsWith('/com.atproto.identity.resolveHandle')) {
      return Response.json({ did })
    }
    if (request.url === `https://plc.directory/${did}` || request.url === 'https://alice.example/.well-known/did.json') {
      return Response.json({ id: did, service: pdsServices })
    }
    if (request.url === `${PDS}/xrpc/com.atproto.server.createSession`) {
      return loginStatus === 200
        ? Response.json({ did, handle: credentials.handle, accessJwt: 'test-access-token', refreshJwt: 'test-refresh-token', active: true })
        : Response.json({ error: 'AuthenticationRequired', message: 'Invalid identifier or password' }, { status: loginStatus })
    }
    if (request.url === `${PDS}/xrpc/com.atproto.repo.createRecord`) {
      return postStatus === 200
        ? Response.json(postResult)
        : Response.json({ error: 'InvalidRequest', message: 'Post rejected' }, { status: postStatus })
    }
    if (request.url === `${PDS}/xrpc/com.atproto.repo.uploadBlob`) {
      return Response.json({ blob: { ...blob, mimeType: request.headers.get('content-type') } })
    }
    const page = pages.get(request.url)
    if (page) return page()
    throw new Error(`Unexpected HTTP request: ${request.method} ${request.url}`)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function record() {
  const posts = requests.filter(request => request.url === `${PDS}/xrpc/com.atproto.repo.createRecord`)
  expect(posts).toHaveLength(1)
  const request = posts[0]!
  expect(request.method).toBe('POST')
  expect(request.headers.get('authorization')).toBe('Bearer test-access-token')
  const body = await request.clone().json()
  expect(body).toMatchObject({ repo: did, collection: 'app.bsky.feed.post' })
  return body.record
}

describe('Bluesky publishing through the real AT Protocol SDK', () => {
  it('resolves the custom PDS, logs in, and publishes a plain post', async () => {
    expect(await postToBluesky(credentials, 'Hello 👋')).toEqual(postResult)
    const login = requests.find(request => request.url.endsWith('/com.atproto.server.createSession'))!
    expect(await login.json()).toEqual({ identifier: credentials.handle, password: credentials.appPassword })
    expect(await record()).toMatchObject({ $type: 'app.bsky.feed.post', text: 'Hello 👋', createdAt: expect.any(String) })
    expect((await record()).embed).toBeUndefined()
    expect(requests.map(request => new URL(request.url).hostname)).not.toContain('bsky.social')
  })

  it('embeds parrot.garden from the btao.org note rather than its feed permalink', async () => {
    const [item] = parseFeed(readFileSync('tests/fixtures/btao-parrot-note.xml', 'utf8'))
    pages.set('http://parrot.garden/', () => new Response(`
      <meta property="og:title" content="parrot.garden — Cross-post RSS to Bluesky &amp; Mastodon">
      <meta property="og:description" content="POSSE your content — automatically syndicate your RSS feeds to Bluesky, Mastodon, and more. Publish on your own site, share everywhere.">
      <meta property="og:image" content="https://parrot.garden/og-image.webp">
    `))
    pages.set('https://parrot.garden/og-image.webp', () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/webp' },
    }))
    const text = truncatePost(renderTemplate('{{content}}', { content: item!.content }), 300)
    await postToBluesky(credentials, text, item!.images)
    expect(await record()).toMatchObject({
      text: 'now that echofeed is shutting down, some of you might be looking for an alternative way to post your RSS feeds to bluesky or mastodon.\ni built http://parrot.garden/ for this a while back. it’s totally free and will stay that way! feature requests are welcome :)',
      facets: [{
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'http://parrot.garden/' }],
        index: { byteStart: 143, byteEnd: 164 },
      }],
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: 'http://parrot.garden/',
          title: 'parrot.garden — Cross-post RSS to Bluesky & Mastodon',
          description: 'POSSE your content — automatically syndicate your RSS feeds to Bluesky, Mastodon, and more. Publish on your own site, share everywhere.',
          thumb: { ...blob, mimeType: 'image/webp' },
        },
      },
    })
    const upload = requests.find(request => request.url.endsWith('/com.atproto.repo.uploadBlob'))!
    expect(upload.headers.get('content-type')).toBe('image/webp')
    expect(new Uint8Array(await upload.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    expect(requests.some(request => request.url === item!.link)).toBe(false)
  })

  it('logs the URL and HTTP status when a card fetch fails, then posts without a card', async () => {
    pages.set(PAGE, () => new Response(null, { status: 522, statusText: 'Connection timed out' }))
    await expect(postToBluesky(credentials, `Read ${PAGE}`)).resolves.toEqual(postResult)
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('Bluesky link card fetch failed', {
      url: PAGE, status: 522, statusText: 'Connection timed out',
    })
    expect((await record()).embed).toBeUndefined()
  })

  it.each([new Error('Fetch failed'), 'Fetch failed'])('logs card exceptions and still posts: %s', async (error) => {
    pages.set(PAGE, () => { throw error })
    await expect(postToBluesky(credentials, `Read ${PAGE}`)).resolves.toEqual(postResult)
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('Bluesky link card creation failed', {
      url: PAGE, error: 'Fetch failed',
    })
    expect((await record()).embed).toBeUndefined()
  })

  it.each([
    `Read ${PAGE}`,
    `Read (${PAGE}).`,
    `Read ${PAGE} then https://blog.example/second`,
  ])('publishes link facets and a card for the first HTTP link: %s', async (text) => {
    pages.set(PAGE, () => new Response('<title>How to read code</title>'))
    await postToBluesky(credentials, text)
    const post = await record()
    expect(post.embed).toEqual({
      $type: 'app.bsky.embed.external', external: { uri: PAGE, title: 'How to read code', description: '' },
    })
    expect(post.facets[0].features).toEqual([{ $type: 'app.bsky.richtext.facet#link', uri: PAGE }])
    expect(requests.some(request => request.url === 'https://blog.example/second')).toBe(false)
  })

  it('uses Open Graph metadata and uploads the relative thumbnail from the final page URL', async () => {
    pages.set(PAGE, () => {
      const response = new Response(`<title>Fallback</title><meta name="description" content="Fallback description">
        <meta property="og:title" content="Canonical title"><meta property="og:description" content="Useful summary">
        <meta property="og:image" content="thumb.png">`)
      Object.defineProperty(response, 'url', { value: 'https://blog.example/redirected/post/' })
      return response
    })
    pages.set('https://blog.example/redirected/post/thumb.png', () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }))
    await postToBluesky(credentials, `Read ${PAGE}`)
    expect((await record()).embed).toEqual({
      $type: 'app.bsky.embed.external',
      external: { uri: PAGE, title: 'Canonical title', description: 'Useful summary', thumb: blob },
    })
    const upload = requests.find(request => request.url.endsWith('/com.atproto.repo.uploadBlob'))!
    expect(upload.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await upload.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it.each(['http://%', '/missing.png'])('keeps a usable card when the thumbnail fails: %s', async (image) => {
    pages.set(PAGE, () => new Response(`<meta property="og:title" content="Valid card"><meta property="og:image" content="${image}">`))
    pages.set('https://blog.example/missing.png', () => new Response('', { status: 404 }))
    await postToBluesky(credentials, `Read ${PAGE}`)
    expect((await record()).embed).toEqual({
      $type: 'app.bsky.embed.external', external: { uri: PAGE, title: 'Valid card', description: '' },
    })
  })

  it('uses standard HTML metadata when Open Graph metadata is absent', async () => {
    pages.set(PAGE, () => new Response('<title>Plain title</title><meta name="description" content="Plain description">'))
    await postToBluesky(credentials, `Read ${PAGE}`)
    expect((await record()).embed.external).toEqual({ uri: PAGE, title: 'Plain title', description: 'Plain description' })
  })

  it('does not fetch a non-HTTP link', async () => {
    await postToBluesky(credentials, 'Invalid link file:///etc/passwd')
    expect((await record()).embed).toBeUndefined()
    expect(requests.some(request => request.url.startsWith('file:'))).toBe(false)
  })

  it('attaches successful feed images with their alt text instead of fetching a link card', async () => {
    pages.set(PHOTO, () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }))
    pages.set('https://blog.example/missing.png', () => new Response('', { status: 404 }))
    await postToBluesky(credentials, `Photos ${PAGE}`, [
      { url: 'https://blog.example/missing.png', alt: 'Missing' },
      { url: PHOTO, alt: 'Green parrot' },
      { url: PHOTO, alt: '' },
    ])
    expect((await record()).embed).toEqual({
      $type: 'app.bsky.embed.images', images: [{ alt: 'Green parrot', image: blob }, { alt: '', image: blob }],
    })
    expect(requests.some(request => request.url === PAGE)).toBe(false)
  })

  it.each([true, false])('falls back after failed feed images, with page available: %s', async (pageAvailable) => {
    pages.set(PHOTO, () => new Response('', { status: 404 }))
    pages.set(PAGE, () => pageAvailable ? new Response('<title>Fallback card</title>') : new Response('', { status: 503 }))
    await postToBluesky(credentials, `Read ${PAGE}`, [{ url: PHOTO, alt: 'Missing' }])
    expect((await record()).embed).toEqual(pageAvailable
      ? { $type: 'app.bsky.embed.external', external: { uri: PAGE, title: 'Fallback card', description: '' } }
      : undefined)
  })

  it('propagates posting errors from the SDK', async () => {
    postStatus = 400
    await expect(postToBluesky(credentials, 'Rejected')).rejects.toMatchObject({ status: 400 })
  })
})

describe('Bluesky authentication', () => {
  it('resolves a did:web identity and accepts valid credentials without publishing', async () => {
    did = 'did:web:alice.example'
    await expect(verifyBlueskyCredentials({ ...credentials, handle: '@alice.example' })).resolves.toBeUndefined()
    expect(requests.some(request => request.url === 'https://alice.example/.well-known/did.json')).toBe(true)
    expect(requests[0]!.url).toContain('handle=alice.example')
    expect(requests.some(request => request.url.endsWith('/com.atproto.repo.createRecord'))).toBe(false)
  })

  it('reports rejected credentials from the real SDK', async () => {
    loginStatus = 401
    await expect(verifyBlueskyCredentials(credentials)).rejects.toThrow('Bluesky authentication failed: Invalid identifier or password')
  })

  it.each([
    ['https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.example', 'Failed to resolve DID'],
    [`https://plc.directory/${DID}`, 'Failed to resolve DID document'],
  ])('reports identity lookup failures at %s', async (url, message) => {
    vi.stubGlobal('fetch', async (input: string) => input === url
      ? new Response('', { status: 404 })
      : Response.json({ did }))
    await expect(verifyBlueskyCredentials(credentials)).rejects.toThrow(`Bluesky authentication failed: ${message}`)
  })

  it('reports an identity document without a PDS service', async () => {
    pdsServices = []
    await expect(verifyBlueskyCredentials(credentials)).rejects.toThrow('No PDS service found')
  })
})
