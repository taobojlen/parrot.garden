import { describe, it, expect, vi } from 'vitest'
import { processConnectionItems, type ExistingLog } from '../../server/utils/poll'
import type { FeedItem } from '../../server/utils/rss'

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
      ['a', { id: 'log-1', itemGuid: 'a', status: 'posted', attempts: 1 }],
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
      ['a', { id: 'log-1', itemGuid: 'a', status: 'skipped', attempts: 0 }],
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

  it('skips items that failed with max attempts', async () => {
    const items = [makeFeedItem('a')]
    const existingLogs = new Map<string, ExistingLog>([
      ['a', { id: 'log-1', itemGuid: 'a', status: 'failed', attempts: 5 }],
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

  it('retries failed items below max attempts and updates existing log', async () => {
    const items = [makeFeedItem('a')]
    const existingLogs = new Map<string, ExistingLog>([
      ['a', { id: 'log-1', itemGuid: 'a', status: 'failed', attempts: 2 }],
    ])
    const postFn = vi.fn()

    const result = await processConnectionItems({
      ...baseArgs,
      items,
      existingLogs,
      postFn,
    })

    expect(result.updates).toHaveLength(1)
    expect(result.updates[0].id).toBe('log-1')
    expect(result.updates[0].set.status).toBe('posted')
    expect(result.posted).toBe(1)
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

  it('marks permanent errors (400/401) with max attempts', async () => {
    const items = [makeFeedItem('a')]
    const err = Object.assign(new Error('unauthorized'), { status: 401 })
    const postFn = vi.fn().mockRejectedValue(err)

    const result = await processConnectionItems({
      ...baseArgs,
      items,
      existingLogs: new Map(),
      postFn,
    })

    expect(result.newRows[0].attempts).toBe(5) // MAX_RETRY_ATTEMPTS
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
})
