import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { processConnectionItems, type ExistingLog } from '../../server/utils/poll'
import type { FeedItem } from '../../server/utils/rss'

function makeExisting(partial: Partial<ExistingLog> & { id: string; itemGuid: string; status: string }): ExistingLog {
  return {
    attempts: 0,
    firstFailedAt: null,
    nextRetryAt: null,
    ...partial,
  }
}

function makeFeedItem(guid: string): FeedItem {
  return {
    guid,
    title: `Item ${guid}`,
    link: `https://example.com/${guid}`,
    description: 'desc',
    content: 'content',
    author: 'author',
    pubDate: '2026-01-01',
    images: [],
  }
}

describe('processConnectionItems', () => {
  const baseArgs = {
    connectionId: 'conn-1',
    template: '{{title}} {{link}}',
    includeImages: false,
    target: { type: 'bluesky' as const, credentials: '{}' },
    maxCharacters: 300,
  }

  it('creates new post_log rows for items not in existing logs', async () => {
    const items = [makeFeedItem('a'), makeFeedItem('b')]
    const postFn = vi.fn()

    const result = await processConnectionItems({
      ...baseArgs,
      items,
      existingLogs: new Map(),
      postFn,
    })

    expect(result.newRows).toHaveLength(2)
    expect(result.newRows[0].itemGuid).toBe('a')
    expect(result.newRows[0].status).toBe('posted')
    expect(result.newRows[1].itemGuid).toBe('b')
    expect(result.posted).toBe(2)
    expect(postFn).toHaveBeenCalledTimes(2)
  })

  it('skips items already posted', async () => {
    const items = [makeFeedItem('a')]
    const existingLogs = new Map<string, ExistingLog>([
      ['a', makeExisting({ id: 'log-1', itemGuid: 'a', status: 'posted', attempts: 1 })],
    ])
    const postFn = vi.fn()

    const result = await processConnectionItems({
      ...baseArgs,
      items,
      existingLogs,
      postFn,
    })

    expect(result.newRows).toHaveLength(0)
    expect(result.updates).toHaveLength(0)
    expect(result.skipped).toBe(1)
    expect(postFn).not.toHaveBeenCalled()
  })

  it('skips items already marked as skipped', async () => {
    const items = [makeFeedItem('a')]
    const existingLogs = new Map<string, ExistingLog>([
      ['a', makeExisting({ id: 'log-1', itemGuid: 'a', status: 'skipped' })],
    ])
    const postFn = vi.fn()

    const result = await processConnectionItems({
      ...baseArgs,
      items,
      existingLogs,
      postFn,
    })

    expect(result.skipped).toBe(1)
    expect(postFn).not.toHaveBeenCalled()
  })

  it('records failed posts with error message', async () => {
    const items = [makeFeedItem('a')]
    const postFn = vi.fn().mockRejectedValue(new Error('network error'))

    const result = await processConnectionItems({
      ...baseArgs,
      items,
      existingLogs: new Map(),
      postFn,
    })

    expect(result.newRows).toHaveLength(1)
    expect(result.newRows[0].status).toBe('failed')
    expect(result.newRows[0].error).toBe('network error')
    expect(result.newRows[0].attempts).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('marks permanent errors (400/401) by setting nextRetryAt to null', async () => {
    const items = [makeFeedItem('a')]
    const err = Object.assign(new Error('unauthorized'), { status: 401 })
    const postFn = vi.fn().mockRejectedValue(err)

    const result = await processConnectionItems({
      ...baseArgs,
      items,
      existingLogs: new Map(),
      postFn,
    })

    expect(result.newRows[0].status).toBe('failed')
    expect(result.newRows[0].nextRetryAt).toBeNull()
    expect(result.failed).toBe(1)
  })

  it('passes images to postFn when includeImages is true', async () => {
    const item = makeFeedItem('a')
    item.images = [{ url: 'https://example.com/img.jpg', alt: 'test' }]
    const postFn = vi.fn()

    await processConnectionItems({
      ...baseArgs,
      includeImages: true,
      items: [item],
      existingLogs: new Map(),
      postFn,
    })

    expect(postFn).toHaveBeenCalledWith(
      {},
      expect.any(String),
      item.images,
    )
  })

  it('does not pass images when includeImages is false', async () => {
    const item = makeFeedItem('a')
    item.images = [{ url: 'https://example.com/img.jpg', alt: 'test' }]
    const postFn = vi.fn()

    await processConnectionItems({
      ...baseArgs,
      includeImages: false,
      items: [item],
      existingLogs: new Map(),
      postFn,
    })

    expect(postFn).toHaveBeenCalledWith(
      {},
      expect.any(String),
      undefined,
    )
  })

  it('appends link and truncates when truncateWithLink is enabled and text exceeds limit', async () => {
    const item = makeFeedItem('a')
    item.title = 'A'.repeat(50)
    const postFn = vi.fn()

    await processConnectionItems({
      ...baseArgs,
      template: '{{title}}',
      maxCharacters: 40,
      truncateWithLink: true,
      items: [item],
      existingLogs: new Map(),
      postFn,
    })

    const postedText = postFn.mock.calls[0][1] as string
    expect(postedText).toContain(item.link)
    expect(postedText).toContain('…')
  })

  it('does not append link when truncateWithLink is enabled but text fits', async () => {
    const item = makeFeedItem('a')
    item.title = 'Short'
    const postFn = vi.fn()

    await processConnectionItems({
      ...baseArgs,
      template: '{{title}}',
      maxCharacters: 300,
      truncateWithLink: true,
      items: [item],
      existingLogs: new Map(),
      postFn,
    })

    const postedText = postFn.mock.calls[0][1] as string
    expect(postedText).toBe('Short')
    expect(postedText).not.toContain(item.link)
  })

  it('does not append link when truncateWithLink is disabled and text exceeds limit', async () => {
    const item = makeFeedItem('a')
    item.title = 'A'.repeat(50)
    const postFn = vi.fn()

    await processConnectionItems({
      ...baseArgs,
      template: '{{title}}',
      maxCharacters: 40,
      truncateWithLink: false,
      items: [item],
      existingLogs: new Map(),
      postFn,
    })

    const postedText = postFn.mock.calls[0][1] as string
    expect(postedText).not.toContain(item.link)
    expect(postedText).toContain('…')
  })

  describe('claimFn (atomic deduplication)', () => {
    it('skips items when claimFn returns false (already claimed)', async () => {
      const items = [makeFeedItem('a'), makeFeedItem('b')]
      const postFn = vi.fn()
      const claimFn = vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs: new Map(),
        postFn,
        claimFn,
      })

      expect(postFn).toHaveBeenCalledTimes(1)
      expect(result.posted).toBe(1)
      expect(result.skipped).toBe(1)
    })

    it('calls claimFn before postFn', async () => {
      const items = [makeFeedItem('a')]
      const callOrder: string[] = []
      const claimFn = vi.fn().mockImplementation(async () => {
        callOrder.push('claim')
        return true
      })
      const postFn = vi.fn().mockImplementation(async () => {
        callOrder.push('post')
      })

      await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs: new Map(),
        postFn,
        claimFn,
      })

      expect(callOrder).toEqual(['claim', 'post'])
    })

    it('returns updates instead of newRows when claimFn succeeds', async () => {
      const items = [makeFeedItem('a')]
      const claimFn = vi.fn().mockResolvedValue(true)
      const postFn = vi.fn()

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs: new Map(),
        postFn,
        claimFn,
      })

      expect(result.newRows).toHaveLength(0)
      expect(result.updates).toHaveLength(1)
      expect(result.updates[0].set.status).toBe('posted')
    })

    it('does not call claimFn for items already in existingLogs', async () => {
      const items = [makeFeedItem('a')]
      const existingLogs = new Map<string, ExistingLog>([
        ['a', makeExisting({ id: 'log-1', itemGuid: 'a', status: 'posted', attempts: 1 })],
      ])
      const claimFn = vi.fn()
      const postFn = vi.fn()

      await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs,
        postFn,
        claimFn,
      })

      expect(claimFn).not.toHaveBeenCalled()
    })

    it('updates claimed row to failed when postFn throws', async () => {
      const items = [makeFeedItem('a')]
      const claimFn = vi.fn().mockResolvedValue(true)
      const postFn = vi.fn().mockRejectedValue(new Error('network error'))

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs: new Map(),
        postFn,
        claimFn,
      })

      expect(result.newRows).toHaveLength(0)
      expect(result.updates).toHaveLength(1)
      expect(result.updates[0].set.status).toBe('failed')
      expect(result.updates[0].set.error).toBe('network error')
      expect(result.failed).toBe(1)
    })
  })

  describe('exponential backoff', () => {
    const NOW = new Date('2026-04-16T12:00:00Z')
    const MIN = 60 * 1000

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('sets firstFailedAt and nextRetryAt to +5m on the first transient failure', async () => {
      const items = [makeFeedItem('a')]
      const postFn = vi.fn().mockRejectedValue(new Error('instance down'))

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs: new Map(),
        postFn,
      })

      expect(result.newRows[0].firstFailedAt).toEqual(NOW)
      expect(result.newRows[0].nextRetryAt).toEqual(new Date(NOW.getTime() + 5 * MIN))
    })

    it('skips failed items whose nextRetryAt is still in the future', async () => {
      const items = [makeFeedItem('a')]
      const existingLogs = new Map<string, ExistingLog>([
        ['a', makeExisting({
          id: 'log-1',
          itemGuid: 'a',
          status: 'failed',
          attempts: 1,
          firstFailedAt: new Date(NOW.getTime() - 1 * MIN),
          nextRetryAt: new Date(NOW.getTime() + 4 * MIN),
        })],
      ])
      const postFn = vi.fn()

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs,
        postFn,
      })

      expect(postFn).not.toHaveBeenCalled()
      expect(result.skipped).toBe(1)
      expect(result.updates).toHaveLength(0)
    })

    it('retries failed items whose nextRetryAt is in the past', async () => {
      const items = [makeFeedItem('a')]
      const existingLogs = new Map<string, ExistingLog>([
        ['a', makeExisting({
          id: 'log-1',
          itemGuid: 'a',
          status: 'failed',
          attempts: 1,
          firstFailedAt: new Date(NOW.getTime() - 10 * MIN),
          nextRetryAt: new Date(NOW.getTime() - 1 * MIN),
        })],
      ])
      const postFn = vi.fn()

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs,
        postFn,
      })

      expect(postFn).toHaveBeenCalledTimes(1)
      expect(result.updates).toHaveLength(1)
      expect(result.updates[0].set.status).toBe('posted')
    })

    it('skips failed items that have been abandoned (nextRetryAt is null)', async () => {
      const items = [makeFeedItem('a')]
      const existingLogs = new Map<string, ExistingLog>([
        ['a', makeExisting({
          id: 'log-1',
          itemGuid: 'a',
          status: 'failed',
          attempts: 3,
          firstFailedAt: new Date(NOW.getTime() - 48 * 60 * MIN),
          nextRetryAt: null,
        })],
      ])
      const postFn = vi.fn()

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs,
        postFn,
      })

      expect(postFn).not.toHaveBeenCalled()
      expect(result.skipped).toBe(1)
    })

    it.each([
      [1, 10],
      [2, 20],
      [3, 40],
      [4, 60],
      [5, 60],
      [10, 60],
    ])('schedules next retry at +%i min after %i previous failures', async (prevAttempts, expectedDelay) => {
      const items = [makeFeedItem('a')]
      const firstFailedAt = new Date(NOW.getTime() - 30 * MIN)
      const existingLogs = new Map<string, ExistingLog>([
        ['a', makeExisting({
          id: 'log-1',
          itemGuid: 'a',
          status: 'failed',
          attempts: prevAttempts,
          firstFailedAt,
          nextRetryAt: new Date(NOW.getTime() - 1 * MIN),
        })],
      ])
      const postFn = vi.fn().mockRejectedValue(new Error('still down'))

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs,
        postFn,
      })

      expect(result.updates).toHaveLength(1)
      const set = result.updates[0].set
      expect(set.status).toBe('failed')
      expect(set.attempts).toBe(prevAttempts + 1)
      expect(set.firstFailedAt).toEqual(firstFailedAt)
      expect(set.nextRetryAt).toEqual(new Date(NOW.getTime() + expectedDelay * MIN))
    })

    it('abandons (nextRetryAt=null) a retry when firstFailedAt is older than 24h', async () => {
      const items = [makeFeedItem('a')]
      const firstFailedAt = new Date(NOW.getTime() - 25 * 60 * MIN)
      const existingLogs = new Map<string, ExistingLog>([
        ['a', makeExisting({
          id: 'log-1',
          itemGuid: 'a',
          status: 'failed',
          attempts: 20,
          firstFailedAt,
          nextRetryAt: new Date(NOW.getTime() - 1 * MIN),
        })],
      ])
      const postFn = vi.fn().mockRejectedValue(new Error('still down'))

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs,
        postFn,
      })

      expect(postFn).toHaveBeenCalledTimes(1)
      expect(result.updates).toHaveLength(1)
      expect(result.updates[0].set.status).toBe('failed')
      expect(result.updates[0].set.nextRetryAt).toBeNull()
    })

    it('clears firstFailedAt and nextRetryAt when a failed item finally posts', async () => {
      const items = [makeFeedItem('a')]
      const existingLogs = new Map<string, ExistingLog>([
        ['a', makeExisting({
          id: 'log-1',
          itemGuid: 'a',
          status: 'failed',
          attempts: 3,
          firstFailedAt: new Date(NOW.getTime() - 2 * 60 * MIN),
          nextRetryAt: new Date(NOW.getTime() - 1 * MIN),
        })],
      ])
      const postFn = vi.fn()

      const result = await processConnectionItems({
        ...baseArgs,
        items,
        existingLogs,
        postFn,
      })

      expect(result.updates[0].set.status).toBe('posted')
      expect(result.updates[0].set.firstFailedAt).toBeNull()
      expect(result.updates[0].set.nextRetryAt).toBeNull()
    })
  })
})
