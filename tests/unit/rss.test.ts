import { describe, it, expect } from 'vitest'
import { parseFeed, type FeedItem } from '../../server/utils/rss'

const RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <item>
      <title>First Post</title>
      <link>https://example.com/first</link>
      <guid>https://example.com/first</guid>
      <description>&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</description>
      <author>Alice</author>
      <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/second</link>
      <guid>second-guid</guid>
      <pubDate>Tue, 02 Jan 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

const ATOM_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <entry>
    <title>Atom Post</title>
    <link href="https://example.com/atom-post"/>
    <id>urn:uuid:atom-1</id>
    <summary>Atom summary</summary>
    <author><name>Bob</name></author>
    <updated>2026-01-01T00:00:00Z</updated>
  </entry>
</feed>`

describe('parseFeed', () => {
  it('parses RSS 2.0 items', () => {
    const items = parseFeed(RSS_SAMPLE)
    expect(items).toHaveLength(2)
    expect(items[1]).toMatchObject({
      guid: 'https://example.com/first',
      title: 'First Post',
      link: 'https://example.com/first',
      author: 'Alice',
    })
  })

  it('strips HTML from descriptions', () => {
    const items = parseFeed(RSS_SAMPLE)
    expect(items[1].description).toBe('Hello world')
  })

  it('parses Atom feeds', () => {
    const items = parseFeed(ATOM_SAMPLE)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      guid: 'urn:uuid:atom-1',
      title: 'Atom Post',
      link: 'https://example.com/atom-post',
      author: 'Bob',
    })
  })

  it('uses link as guid fallback', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>No GUID</title><link>https://example.com/no-guid</link></item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].guid).toBe('https://example.com/no-guid')
  })

  it('throws on invalid XML', () => {
    expect(() => parseFeed('not xml')).toThrow()
  })

  it('returns items sorted newest first', () => {
    const items = parseFeed(RSS_SAMPLE)
    expect(items[0].title).toBe('Second Post')
  })
})
