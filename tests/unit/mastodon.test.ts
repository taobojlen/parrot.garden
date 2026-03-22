import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postToMastodon, normalizeInstanceUrl } from '../../server/utils/mastodon'
import type { FeedImage } from '../../server/utils/rss'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const credentials = {
  instanceUrl: 'mastodon.social',
  accessToken: 'test-token',
  maxCharacters: 500,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeInstanceUrl', () => {
  it('strips https:// prefix', () => {
    expect(normalizeInstanceUrl('https://mastodon.social')).toBe('mastodon.social')
  })

  it('strips http:// prefix', () => {
    expect(normalizeInstanceUrl('http://mastodon.social')).toBe('mastodon.social')
  })

  it('strips trailing slash', () => {
    expect(normalizeInstanceUrl('mastodon.social/')).toBe('mastodon.social')
  })

  it('lowercases', () => {
    expect(normalizeInstanceUrl('Mastodon.Social')).toBe('mastodon.social')
  })

  it('handles combination', () => {
    expect(normalizeInstanceUrl('HTTPS://Mastodon.Social/')).toBe('mastodon.social')
  })
})

describe('postToMastodon', () => {
  it('posts a status with text only', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: '12345', url: 'https://mastodon.social/@user/12345' }),
    })

    await postToMastodon(credentials, 'Hello from Parrot')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mastodon.social/api/v1/statuses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
        }),
      }),
    )
  })

  it('uploads images and attaches media_ids', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'media-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '12345' }),
      })

    const images: FeedImage[] = [
      { url: 'https://example.com/photo.jpg', alt: 'A photo' },
    ]
    await postToMastodon(credentials, 'With image', images)

    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('skips images that fail to download', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '12345' }),
      })

    const images: FeedImage[] = [
      { url: 'https://example.com/broken.jpg', alt: 'Broken' },
    ]
    await postToMastodon(credentials, 'Broken image', images)

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws on non-ok status response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Unauthorized'),
    })

    await expect(postToMastodon(credentials, 'Will fail'))
      .rejects.toThrow()
  })
})
