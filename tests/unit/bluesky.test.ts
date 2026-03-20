import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postToBluesky } from '../../server/utils/bluesky'
import type { FeedImage } from '../../server/utils/rss'

// Mock @atproto/api
const mockPost = vi.fn().mockResolvedValue({ uri: 'at://did:plc:test/post/1', cid: 'bafytest' })
const mockUploadBlob = vi.fn().mockResolvedValue({
  data: { blob: { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 } },
})
const mockLogin = vi.fn().mockResolvedValue({})
const mockDetectFacets = vi.fn().mockResolvedValue(undefined)

vi.mock('@atproto/api', () => {
  return {
    AtpAgent: class {
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

beforeEach(() => {
  vi.clearAllMocks()
  mockPost.mockResolvedValue({ uri: 'at://did:plc:test/post/1', cid: 'bafytest' })
  mockUploadBlob.mockResolvedValue({
    data: { blob: { ref: { $link: 'blob-ref-123' }, mimeType: 'image/jpeg', size: 1234 } },
  })
  mockFetch.mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  })
})

describe('postToBluesky', () => {
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

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockUploadBlob).toHaveBeenCalledTimes(2)

    const postArg = mockPost.mock.calls[0][0]
    expect(postArg.embed.images).toHaveLength(2)
    expect(postArg.embed.images[0].alt).toBe('First')
    expect(postArg.embed.images[1].alt).toBe('Second')
  })

  it('skips images that fail to download', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
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
    mockFetch.mockResolvedValue({ ok: false, status: 500 })

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
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/webp' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
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
