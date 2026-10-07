import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { postToBluesky, resolvePdsUrl, verifyBlueskyCredentials } from '../../server/utils/bluesky'
import { parseFeed } from '../../server/utils/rss'
import { renderTemplate, truncatePost } from '../../server/utils/template'
import type { FeedImage } from '../../server/utils/rss'

// Mock @atproto/api
const mockPost = vi.fn().mockResolvedValue({ uri: 'at://did:plc:test/post/1', cid: 'bafytest' })
const mockUploadBlob = vi.fn().mockResolvedValue({
  data: { blob: { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 } },
})
const mockLogin = vi.fn().mockResolvedValue({})

const mockAtpAgentConstructor = vi.fn()

vi.mock('@atproto/api', async (importOriginal) => {
  const { RichText } = await importOriginal<typeof import('@atproto/api')>()
  return {
    AtpAgent: class {
      constructor(opts: { service: string }) {
        mockAtpAgentConstructor(opts)
      }

      login = mockLogin
      post = mockPost
      uploadBlob = mockUploadBlob
    },
    RichText,
  }
})

// Mock global fetch for image downloading
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const credentials = { handle: 'test.bsky.social', appPassword: 'test-password' }

// Default mock: resolves handle via XRPC, DID doc via PLC directory, images via fetch
function mockFetchForPds() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('com.atproto.identity.resolveHandle')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ did: 'did:plc:testuser123' }),
      })
    }
    if (url.includes('plc.directory')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 'did:plc:testuser123',
          service: [{
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://bsky.social',
          }],
        }),
      })
    }
    // Default: image download response
    return Promise.resolve({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mockPost.mockResolvedValue({ uri: 'at://did:plc:test/post/1', cid: 'bafytest' })
  mockUploadBlob.mockResolvedValue({
    data: { blob: { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 } },
  })
  mockFetchForPds()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('postToBluesky', () => {
  it('resolves PDS URL from handle before creating agent', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('com.atproto.identity.resolveHandle')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ did: 'did:plc:custom123' }),
        })
      }
      if (url.includes('plc.directory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'did:plc:custom123',
            service: [{
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://custom-pds.example.com',
            }],
          }),
        })
      }
      return Promise.resolve({ ok: false })
    })

    await postToBluesky({ handle: 'alice.custom.com', appPassword: 'pw' }, 'Hello')

    expect(mockAtpAgentConstructor).toHaveBeenCalledWith({
      service: 'https://custom-pds.example.com',
    })
  })

  it('posts without embed when no images provided', async () => {
    await postToBluesky(credentials, 'Hello world')
    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Hello world',
      }),
    )
    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed).toBeUndefined()
  })

  it('posts without embed when images array is empty', async () => {
    await postToBluesky(credentials, 'Hello world', [])
    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed).toBeUndefined()
  })

  it('does not fetch a card when the post text has no link', async () => {
    await postToBluesky(credentials, 'Just a thought.')

    expect(mockPost.mock.calls[0][0].embed).toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(2) // Handle resolution and DID document only
  })

  it('embeds parrot.garden from the btao.org note rather than its feed permalink', async () => {
    const [item] = parseFeed(readFileSync('tests/fixtures/btao-parrot-note.xml', 'utf8'))
    const defaultFetch = mockFetch.getMockImplementation()!
    mockFetch.mockImplementation((url: string) => {
      if (url === 'http://parrot.garden/') {
        return Promise.resolve(new Response(`
          <meta property="og:title" content="parrot.garden — Cross-post RSS to Bluesky &amp; Mastodon">
          <meta property="og:description" content="POSSE your content — automatically syndicate your RSS feeds to Bluesky, Mastodon, and more. Publish on your own site, share everywhere.">
          <meta property="og:image" content="https://parrot.garden/og-image.webp">
        `))
      }
      if (url === 'https://parrot.garden/og-image.webp') {
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': 'image/webp' },
        }))
      }
      return defaultFetch(url)
    })

    const text = truncatePost(renderTemplate('{{content}}', { content: item!.content }), 300)
    await postToBluesky(credentials, text, item!.images)

    expect(mockPost.mock.calls[0][0]).toMatchObject({
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
          thumb: { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 },
        },
      },
    })
    expect(mockUploadBlob).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), { encoding: 'image/webp' })
    expect(mockFetch).not.toHaveBeenCalledWith(item!.link)
  })

  it.each([
    'Most people read code very badly.\n\nhttps://seangoedecke.com/how-to-read-code/',
    'Read https://seangoedecke.com/how-to-read-code/ then https://example.com/second',
    'Read (https://seangoedecke.com/how-to-read-code/).',
  ])('embeds the first detected post link: %s', async (text) => {
    const defaultFetch = mockFetch.getMockImplementation()!
    mockFetch.mockImplementation((url: string) => {
      if (url === 'https://seangoedecke.com/how-to-read-code/') {
        return Promise.resolve(new Response('<title>How to read code</title>'))
      }
      return defaultFetch(url)
    })

    await postToBluesky(credentials, text)

    expect(mockPost.mock.calls[0][0].embed).toEqual({
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://seangoedecke.com/how-to-read-code/',
        title: 'How to read code',
        description: '',
      },
    })
    expect(mockFetch).not.toHaveBeenCalledWith('https://example.com/second')
  })

  it('creates an external card from the post link when no image is attached', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('com.atproto.identity.resolveHandle')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ did: 'did:plc:testuser123' }) })
      }
      if (url.includes('plc.directory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'did:plc:testuser123',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social' }],
          }),
        })
      }
      if (url === 'https://example.com/posts/one') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`
            <html><head>
              <meta property="og:title" content="The canonical title">
              <meta property="og:description" content="A useful summary">
              <meta property="og:image" content="/images/card.jpg">
            </head></html>
          `),
        })
      }
      if (url === 'https://example.com/images/card.jpg') {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'image/jpeg' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        })
      }
      return Promise.resolve({ ok: false })
    })

    await postToBluesky(
      credentials,
      'Read this https://example.com/posts/one',
    )

    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed).toEqual({
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://example.com/posts/one',
        title: 'The canonical title',
        description: 'A useful summary',
        thumb: { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 },
      },
    })
  })

  it('resolves a relative card image against the final URL after redirects', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('com.atproto.identity.resolveHandle')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ did: 'did:plc:testuser123' }) })
      }
      if (url.includes('plc.directory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'did:plc:testuser123',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social' }],
          }),
        })
      }
      if (url === 'https://example.com/article') {
        return Promise.resolve({
          ok: true,
          url: 'https://example.com/posts/article/',
          text: () => Promise.resolve('<meta property="og:image" content="thumb.jpg">'),
        })
      }
      if (url === 'https://example.com/posts/article/thumb.jpg') {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'image/jpeg' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        })
      }
      return Promise.resolve({ ok: false })
    })

    await postToBluesky(credentials, 'Redirected article https://example.com/article')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/posts/article/thumb.jpg')
    expect(mockPost.mock.calls[0][0].embed.external.thumb).toEqual(
      { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 },
    )
  })

  it('keeps the external card when its image URL is malformed', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('com.atproto.identity.resolveHandle')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ did: 'did:plc:testuser123' }) })
      }
      if (url.includes('plc.directory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'did:plc:testuser123',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social' }],
          }),
        })
      }
      if (url === 'https://example.com/posts/broken-image') {
        return Promise.resolve({
          ok: true,
          url,
          text: () => Promise.resolve(`
            <meta property="og:title" content="Valid card">
            <meta property="og:description" content="Still useful">
            <meta property="og:image" content="http://%">
          `),
        })
      }
      return Promise.resolve({ ok: false })
    })

    await postToBluesky(
      credentials,
      'Malformed card image https://example.com/posts/broken-image',
    )

    expect(mockPost.mock.calls[0][0].embed).toEqual({
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://example.com/posts/broken-image',
        title: 'Valid card',
        description: 'Still useful',
      },
    })
  })

  it('falls back to standard HTML metadata when Open Graph tags are absent', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('com.atproto.identity.resolveHandle')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ did: 'did:plc:testuser123' }) })
      }
      if (url.includes('plc.directory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'did:plc:testuser123',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social' }],
          }),
        })
      }
      if (url === 'https://example.com/posts/plain') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`
            <html><head>
              <title>A plain HTML title</title>
              <meta name="description" content="A standard description">
            </head></html>
          `),
        })
      }
      return Promise.resolve({ ok: false })
    })

    await postToBluesky(
      credentials,
      'Read this https://example.com/posts/plain',
    )

    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed.external).toEqual({
      uri: 'https://example.com/posts/plain',
      title: 'A plain HTML title',
      description: 'A standard description',
    })
  })

  it('does not fetch a non-HTTP link in the post', async () => {
    await postToBluesky(
      credentials,
      'Invalid link file:///etc/passwd',
    )

    expect(mockFetch).not.toHaveBeenCalledWith('file:///etc/passwd')
    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed).toBeUndefined()
  })

  it('uploads images and attaches them as embed', async () => {
    const images: FeedImage[] = [
      { url: 'https://example.com/photo.jpg', alt: 'A nice photo' },
    ]
    await postToBluesky(credentials, 'Check this out', images)

    // Should fetch the image
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/photo.jpg')

    // Should upload the blob
    expect(mockUploadBlob).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({ encoding: 'image/jpeg' }),
    )

    // Should include embed in post
    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed).toEqual({
      $type: 'app.bsky.embed.images',
      images: [
        {
          alt: 'A nice photo',
          image: { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 },
        },
      ],
    })
  })

  it('prefers an attached feed image over an external card', async () => {
    const images: FeedImage[] = [
      { url: 'https://example.com/photo.jpg', alt: 'A nice photo' },
    ]

    await postToBluesky(
      credentials,
      'Check this out https://example.com/posts/one',
      images,
    )

    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed.$type).toBe('app.bsky.embed.images')
    expect(mockFetch).not.toHaveBeenCalledWith('https://example.com/posts/one')
  })

  it('uploads multiple images', async () => {
    const images: FeedImage[] = [
      { url: 'https://example.com/1.jpg', alt: 'First' },
      { url: 'https://example.com/2.jpg', alt: 'Second' },
    ]
    await postToBluesky(credentials, 'Multiple images', images)

    const imageFetchCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => !url.includes('resolveHandle') && !url.includes('plc.directory'),
    )
    expect(imageFetchCalls).toHaveLength(2)
    expect(mockUploadBlob).toHaveBeenCalledTimes(2)

    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed.images).toHaveLength(2)
    expect(postArg.embed.images[0].alt).toBe('First')
    expect(postArg.embed.images[1].alt).toBe('Second')
  })

  it('skips images that fail to download', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('com.atproto.identity.resolveHandle')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ did: 'did:plc:testuser123' }) })
      }
      if (url.includes('plc.directory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'did:plc:testuser123',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social' }],
          }),
        })
      }
      if (url.includes('missing.jpg')) return Promise.resolve({ ok: false, status: 404 })
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    })

    const images: FeedImage[] = [
      { url: 'https://example.com/missing.jpg', alt: 'Missing' },
      { url: 'https://example.com/found.png', alt: 'Found' },
    ]
    await postToBluesky(credentials, 'Partial images', images)

    expect(mockUploadBlob).toHaveBeenCalledTimes(1)
    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed.images).toHaveLength(1)
    expect(postArg.embed.images[0].alt).toBe('Found')
  })

  it('logs the URL and HTTP status when a card fetch fails, then posts without a card', async () => {
    const defaultFetch = mockFetch.getMockImplementation()!
    mockFetch.mockImplementation((url: string) => {
      if (url === 'http://parrot.garden/') {
        return Promise.resolve(new Response(null, { status: 522, statusText: 'Connection timed out' }))
      }
      return defaultFetch(url)
    })

    await expect(postToBluesky(credentials, 'Read http://parrot.garden/'))
      .resolves.toEqual({ uri: 'at://did:plc:test/post/1', cid: 'bafytest' })

    expect(console.warn).toHaveBeenCalledExactlyOnceWith('Bluesky link card fetch failed', {
      url: 'http://parrot.garden/',
      status: 522,
      statusText: 'Connection timed out',
    })
    expect(mockPost.mock.calls[0][0].embed).toBeUndefined()
  })

  it.each([new Error('Fetch failed'), 'Fetch failed'])(
    'logs card exceptions and still posts: %s', async (error) => {
      const defaultFetch = mockFetch.getMockImplementation()!
      mockFetch.mockImplementation((url: string) => {
        if (url === 'http://parrot.garden/') return Promise.reject(error)
        return defaultFetch(url)
      })

      await expect(postToBluesky(credentials, 'Read http://parrot.garden/'))
        .resolves.toEqual({ uri: 'at://did:plc:test/post/1', cid: 'bafytest' })

      expect(console.warn).toHaveBeenCalledExactlyOnceWith('Bluesky link card creation failed', {
        url: 'http://parrot.garden/',
        error: 'Fetch failed',
      })
      expect(mockPost.mock.calls[0][0].embed).toBeUndefined()
    },
  )

  it('posts without embed when images and linked page fail to download', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('com.atproto.identity.resolveHandle')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ did: 'did:plc:testuser123' }) })
      }
      if (url.includes('plc.directory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'did:plc:testuser123',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social' }],
          }),
        })
      }
      return Promise.resolve({ ok: false, status: 500 })
    })

    const images: FeedImage[] = [
      { url: 'https://example.com/broken.jpg', alt: 'Broken' },
    ]
    await postToBluesky(credentials, 'No images work https://example.com/post', images)

    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed).toBeUndefined()
  })

  it('falls back to the external card when all feed images fail to download', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('com.atproto.identity.resolveHandle')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ did: 'did:plc:testuser123' }) })
      }
      if (url.includes('plc.directory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'did:plc:testuser123',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social' }],
          }),
        })
      }
      if (url === 'https://example.com/broken.jpg') {
        return Promise.resolve({ ok: false, status: 404 })
      }
      if (url === 'https://example.com/post') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<meta property="og:title" content="Fallback card">'),
        })
      }
      return Promise.resolve({ ok: false })
    })

    const images: FeedImage[] = [
      { url: 'https://example.com/broken.jpg', alt: 'Broken' },
    ]
    await postToBluesky(credentials, 'Fallback https://example.com/post', images)

    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed).toEqual({
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://example.com/post',
        title: 'Fallback card',
        description: '',
      },
    })
  })

  it('uses empty alt text when image has no alt', async () => {
    const images: FeedImage[] = [
      { url: 'https://example.com/photo.jpg', alt: '' },
    ]
    await postToBluesky(credentials, 'No alt', images)

    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed.images[0].alt).toBe('')
  })

  it('detects content type from response headers', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('com.atproto.identity.resolveHandle')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ did: 'did:plc:testuser123' }) })
      }
      if (url.includes('plc.directory')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'did:plc:testuser123',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social' }],
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'image/webp' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    })

    const images: FeedImage[] = [
      { url: 'https://example.com/photo.webp', alt: 'Webp image' },
    ]
    await postToBluesky(credentials, 'Webp test', images)

    expect(mockUploadBlob).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({ encoding: 'image/webp' }),
    )
  })
})

describe('resolvePdsUrl', () => {
  it('resolves PDS URL via resolveHandle XRPC and PLC directory', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ did: 'did:plc:abc123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'did:plc:abc123',
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://my-custom-pds.example.com',
            },
          ],
        }),
      })

    const result = await resolvePdsUrl('alice.example.com', fakeFetch)

    expect(result).toBe('https://my-custom-pds.example.com')
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.example.com',
    )
    expect(fakeFetch).toHaveBeenCalledWith('https://plc.directory/did:plc:abc123')
  })

  it('resolves did:web handles via .well-known/did.json', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ did: 'did:web:bob.example.com' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'did:web:bob.example.com',
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.bob.example.com',
            },
          ],
        }),
      })

    const result = await resolvePdsUrl('bob.example.com', fakeFetch)

    expect(result).toBe('https://pds.bob.example.com')
    expect(fakeFetch).toHaveBeenCalledWith('https://bob.example.com/.well-known/did.json')
  })

  it('strips leading @ from handle', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ did: 'did:plc:abc123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'did:plc:abc123',
          service: [{
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://pds.example.com',
          }],
        }),
      })

    const result = await resolvePdsUrl('@alice.example.com', fakeFetch)

    expect(result).toBe('https://pds.example.com')
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.example.com',
    )
  })

  it('throws when handle resolution fails', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false })

    await expect(resolvePdsUrl('alice.example.com', fakeFetch))
      .rejects.toThrow('Failed to resolve DID for handle "alice.example.com"')
  })

  it('throws when DID document fetch fails', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ did: 'did:plc:abc123' }),
      })
      .mockResolvedValueOnce({ ok: false })

    await expect(resolvePdsUrl('alice.example.com', fakeFetch))
      .rejects.toThrow('Failed to resolve DID document for "did:plc:abc123"')
  })

  it('throws when DID document has no PDS service', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ did: 'did:plc:abc123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'did:plc:abc123',
          service: [],
        }),
      })

    await expect(resolvePdsUrl('alice.example.com', fakeFetch))
      .rejects.toThrow('No PDS service found in DID document for "did:plc:abc123"')
  })
})

describe('verifyBlueskyCredentials', () => {
  it('resolves PDS and attempts login', async () => {
    await verifyBlueskyCredentials({ handle: 'test.bsky.social', appPassword: 'test-password' })

    expect(mockAtpAgentConstructor).toHaveBeenCalledWith({
      service: 'https://bsky.social',
    })
    expect(mockLogin).toHaveBeenCalledWith({
      identifier: 'test.bsky.social',
      password: 'test-password',
    })
  })

  it('throws descriptive error when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid identifier or password'))

    await expect(
      verifyBlueskyCredentials({ handle: 'test.bsky.social', appPassword: 'bad-password' }),
    ).rejects.toThrow('Bluesky authentication failed: Invalid identifier or password')
  })

  it('throws descriptive error when PDS resolution fails', async () => {
    mockFetch.mockImplementation(() => Promise.resolve({ ok: false }))

    await expect(
      verifyBlueskyCredentials({ handle: 'nonexistent.example.com', appPassword: 'pw' }),
    ).rejects.toThrow('Bluesky authentication failed: Failed to resolve DID for handle "nonexistent.example.com"')
  })
})
