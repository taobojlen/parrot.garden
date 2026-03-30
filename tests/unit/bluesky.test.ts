import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postToBluesky, resolvePdsUrl, verifyBlueskyCredentials } from '../../server/utils/bluesky'
import type { FeedImage } from '../../server/utils/rss'

// Mock @atproto/api
const mockPost = vi.fn().mockResolvedValue({ uri: 'at://did:plc:test/post/1', cid: 'bafytest' })
const mockUploadBlob = vi.fn().mockResolvedValue({
  data: { blob: { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 } },
})
const mockLogin = vi.fn().mockResolvedValue({})
const mockDetectFacets = vi.fn().mockResolvedValue(undefined)

const mockAtpAgentConstructor = vi.fn()

vi.mock('@atproto/api', () => {
  return {
    AtpAgent: class {
      constructor(opts: { service: string }) {
        mockAtpAgentConstructor(opts)
      }

      login = mockLogin
      post = mockPost
      uploadBlob = mockUploadBlob
    },
    RichText: class {
      text: string
      facets: undefined
      constructor({ text }: { text: string }) {
        this.text = text
      }

      detectFacets = mockDetectFacets
    },
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
  mockPost.mockResolvedValue({ uri: 'at://did:plc:test/post/1', cid: 'bafytest' })
  mockUploadBlob.mockResolvedValue({
    data: { blob: { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 } },
  })
  mockFetchForPds()
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

  it('posts without embed if all images fail to download', async () => {
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
    await postToBluesky(credentials, 'No images work', images)

    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed).toBeUndefined()
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
