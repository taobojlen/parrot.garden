import { describe, it, expect } from 'vitest'
import { filterNewItems } from '../../server/utils/poll'
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

describe('filterNewItems', () => {
  it('excludes items first seen before the connection was created', () => {
    const items = [makeFeedItem('a'), makeFeedItem('b')]
    const sourceItemDates = new Map<string, Date>([
      ['a', new Date('2026-01-01')],
      ['b', new Date('2026-01-02')],
    ])
    const connectionCreatedAt = new Date('2026-01-03')

    const result = filterNewItems(items, sourceItemDates, connectionCreatedAt)

    expect(result).toHaveLength(0)
  })

  it('includes items first seen after the connection was created', () => {
    const items = [makeFeedItem('a'), makeFeedItem('b')]
    const sourceItemDates = new Map<string, Date>([
      ['a', new Date('2026-01-01')],
      ['b', new Date('2026-01-05')],
    ])
    const connectionCreatedAt = new Date('2026-01-03')

    const result = filterNewItems(items, sourceItemDates, connectionCreatedAt)

    expect(result).toHaveLength(1)
    expect(result[0].guid).toBe('b')
  })

  it('includes items not yet tracked in sourceItems (just discovered)', () => {
    const items = [makeFeedItem('a'), makeFeedItem('new')]
    const sourceItemDates = new Map<string, Date>([
      ['a', new Date('2026-01-01')],
    ])
    const connectionCreatedAt = new Date('2026-01-03')

    const result = filterNewItems(items, sourceItemDates, connectionCreatedAt)

    expect(result).toHaveLength(1)
    expect(result[0].guid).toBe('new')
  })

  it('excludes items seen at exactly the same time as connection creation', () => {
    const items = [makeFeedItem('a')]
    const same = new Date('2026-01-03')
    const sourceItemDates = new Map<string, Date>([['a', same]])

    const result = filterNewItems(items, sourceItemDates, same)

    expect(result).toHaveLength(0)
  })
})
