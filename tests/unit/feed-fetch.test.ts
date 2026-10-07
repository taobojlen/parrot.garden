// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFeed, fetchAndParseFeed } from '../../server/utils/rss'
import { feedRetryAt } from '../../server/utils/poll'

const xml = '<rss><channel><item><guid>one</guid><title>One</title></item></channel></rss>'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('bounded conditional feed fetching', () => {
  it('sends validators and returns new validators with parsed items', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(xml, {
      headers: { ETag: '"new"', 'Last-Modified': 'Wed, 07 Oct 2026 09:00:00 GMT' },
    }))
    vi.stubGlobal('fetch', fetch)
    const result = await fetchFeed('https://example.com/rss', { etag: '"old"', lastModified: 'Tue, 06 Oct 2026 09:00:00 GMT' })
    expect(fetch.mock.calls[0][1].headers).toMatchObject({
      'If-None-Match': '"old"', 'If-Modified-Since': 'Tue, 06 Oct 2026 09:00:00 GMT',
    })
    expect(result).toMatchObject({ etag: '"new"', lastModified: 'Wed, 07 Oct 2026 09:00:00 GMT', items: [{ guid: 'one' }] })
  })

  it('handles 304 without parsing a body and retains omitted validators', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 304 })))
    expect(await fetchFeed('https://example.com/rss', { etag: '"old"', lastModified: 'date' }))
      .toEqual({ items: null, etag: '"old"', lastModified: 'date' })
  })

  it('clears validators when a changed response omits them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(xml)))
    expect(await fetchFeed('https://example.com/rss', { etag: '"old"' })).toMatchObject({ etag: null, lastModified: null })
  })

  it('rejects declared oversized bodies before reading them', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), {
      headers: { 'Content-Length': String(2 * 1024 * 1024 + 1) },
    })))
    await expect(fetchAndParseFeed('https://example.com/rss')).rejects.toThrow('size limit')
    expect(cancel).toHaveBeenCalled()
  })

  it('limits streamed bytes even with a misleading Content-Length', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(2 * 1024 * 1024))
        controller.enqueue(new Uint8Array(1))
      }, cancel,
    }), { headers: { 'Content-Length': '1' } })))
    await expect(fetchFeed('https://example.com/rss')).rejects.toThrow('size limit')
    expect(cancel).toHaveBeenCalled()
  })

  it('accepts a body exactly at the size limit', async () => {
    const padded = xml + ' '.repeat(2 * 1024 * 1024 - new TextEncoder().encode(xml).byteLength)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(padded)))
    expect((await fetchFeed('https://example.com/rss')).items).toMatchObject([{ guid: 'one' }])
  })

  it('decodes UTF-8 characters split across stream chunks', async () => {
    const bytes = new TextEncoder().encode(xml.replace('One', '🦜'))
    const split = bytes.indexOf(0xf0) + 2
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, split))
        controller.enqueue(bytes.slice(split))
        controller.close()
      },
    }))))
    expect((await fetchFeed('https://example.com/rss')).items?.[0]?.title).toBe('🦜')
  })

  it.each(['headers', 'body'])('enforces the total deadline while waiting for %s', async (phase) => {
    vi.useFakeTimers()
    let signal: AbortSignal
    vi.stubGlobal('fetch', vi.fn((_url, options) => {
      signal = options.signal
      if (phase === 'body') return Promise.resolve(new Response(new ReadableStream()))
      return new Promise(() => {})
    }))
    const assertion = expect(fetchFeed('https://example.com/rss')).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
    expect(signal!.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([429, 503])('exposes Retry-After on HTTP %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('slow down', { status, headers: { 'Retry-After': '900' } })))
    await expect(fetchFeed('https://example.com/rss')).rejects.toMatchObject({ status, retryAfter: '900' })
  })
})

describe('feed backoff', () => {
  const now = new Date('2026-10-07T10:00:00Z')
  it('increases from five minutes and caps at one day', () => {
    expect(feedRetryAt(now, 1).getTime() - now.getTime()).toBe(300_000)
    expect(feedRetryAt(now, 3).getTime() - now.getTime()).toBe(1_200_000)
    expect(feedRetryAt(now, 100).getTime() - now.getTime()).toBe(86_400_000)
  })
  it('honors seconds and HTTP dates without shortening exponential backoff', () => {
    expect(feedRetryAt(now, 1, '900').toISOString()).toBe('2026-10-07T10:15:00.000Z')
    expect(feedRetryAt(now, 1, 'Wed, 07 Oct 2026 12:00:00 GMT').toISOString()).toBe('2026-10-07T12:00:00.000Z')
    for (const value of ['invalid', '-1', '0', 'Wed, 07 Oct 2026 09:00:00 GMT']) {
      expect(feedRetryAt(now, 1, value).toISOString()).toBe('2026-10-07T10:05:00.000Z')
    }
  })
})
