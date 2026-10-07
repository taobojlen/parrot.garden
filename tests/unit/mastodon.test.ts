import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { postToMastodon, normalizeInstanceUrl } from '../../server/utils/mastodon'
import type { FeedImage } from '../../server/utils/rss'

const mockFetch = vi.fn()

const credentials = {
  instanceUrl: 'mastodon.social',
  accessToken: 'test-token',
  maxCharacters: 500,
}

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => vi.unstubAllGlobals())

describe('normalizeInstanceUrl', () => {
  it('normalizes user-supplied instance URLs', () => {
    expect([
      'https://Mastodon.Social///', 'http://mastodon.social/', 'mastodon.social',
    ].map(normalizeInstanceUrl)).toEqual(['mastodon.social', 'mastodon.social', 'mastodon.social'])
  })
})

describe('postToMastodon', () => {
  it.each(['download', 'upload'])('still publishes text when an image %s fails', async (failure) => {
    mockFetch
      .mockImplementation(async (url: string) => {
        if (url === 'https://example.com/broken.jpg') {
          return failure === 'download'
            ? new Response('', { status: 404 })
            : new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })
        }
        if (url === 'https://mastodon.social/api/v1/media') return new Response('', { status: 503 })
        if (url === 'https://mastodon.social/api/v1/statuses') return Response.json({ id: '12345' })
        throw new Error(`Unexpected HTTP request: ${url}`)
      })

    const images: FeedImage[] = [
      { url: 'https://example.com/broken.jpg', alt: 'Broken' },
    ]
    expect(await postToMastodon(credentials, 'Broken image', images)).toEqual({ id: '12345' })

    const statusCalls = mockFetch.mock.calls.filter(([url]) => url.endsWith('/api/v1/statuses'))
    expect(statusCalls).toHaveLength(1)
    expect(JSON.parse(statusCalls[0]![1].body)).toEqual({ status: 'Broken image' })
  })

  it('throws on non-ok status response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Unauthorized'),
    })

    await expect(postToMastodon(credentials, 'Will fail'))
      .rejects.toMatchObject({ status: 401, message: 'Mastodon API error: 401 Unauthorized' })
  })
})
