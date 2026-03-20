import { describe, it, expect } from 'vitest'
import { parseFeed, type FeedItem, type FeedImage } from '../../server/utils/rss'

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

  it('returns empty images array when no images present', () => {
    const items = parseFeed(RSS_SAMPLE)
    expect(items[0].images).toEqual([])
    expect(items[1].images).toEqual([])
  })

  it('extracts images from RSS enclosures with image type', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>With Image</title>
        <link>https://example.com/img</link>
        <enclosure url="https://example.com/photo.jpg" type="image/jpeg" length="12345" />
      </item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].images).toEqual([
      { url: 'https://example.com/photo.jpg', alt: '' },
    ])
  })

  it('ignores non-image enclosures', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>Audio Post</title>
        <link>https://example.com/audio</link>
        <enclosure url="https://example.com/episode.mp3" type="audio/mpeg" length="99999" />
      </item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].images).toEqual([])
  })

  it('extracts images from media:content elements', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
      <item>
        <title>Media Post</title>
        <link>https://example.com/media</link>
        <media:content url="https://example.com/photo.png" medium="image">
          <media:description>A nice photo</media:description>
        </media:content>
      </item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].images).toEqual([
      { url: 'https://example.com/photo.png', alt: 'A nice photo' },
    ])
  })

  it('extracts images from media:content with type attribute', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
      <item>
        <title>Media Type Post</title>
        <link>https://example.com/media2</link>
        <media:content url="https://example.com/img.webp" type="image/webp" />
      </item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].images).toEqual([
      { url: 'https://example.com/img.webp', alt: '' },
    ])
  })

  it('extracts images from img tags in HTML content', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>HTML Images</title>
        <link>https://example.com/html</link>
        <description>&lt;p&gt;Check this out&lt;/p&gt;&lt;img src="https://example.com/inline.jpg" alt="Inline photo" /&gt;</description>
      </item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].images).toEqual([
      { url: 'https://example.com/inline.jpg', alt: 'Inline photo' },
    ])
  })

  it('extracts images from img tags in content:encoded', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>Content Images</title>
        <link>https://example.com/content</link>
        <content:encoded>&lt;img src="https://example.com/content-img.png" alt="Content image" /&gt;&lt;p&gt;Text&lt;/p&gt;</content:encoded>
      </item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].images).toEqual([
      { url: 'https://example.com/content-img.png', alt: 'Content image' },
    ])
  })

  it('limits images to 4 per item', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>Many Images</title>
        <link>https://example.com/many</link>
        <description>&lt;img src="https://example.com/1.jpg" alt="one" /&gt;&lt;img src="https://example.com/2.jpg" alt="two" /&gt;&lt;img src="https://example.com/3.jpg" alt="three" /&gt;&lt;img src="https://example.com/4.jpg" alt="four" /&gt;&lt;img src="https://example.com/5.jpg" alt="five" /&gt;</description>
      </item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].images).toHaveLength(4)
  })

  it('deduplicates images by URL', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>Dupes</title>
        <link>https://example.com/dupes</link>
        <enclosure url="https://example.com/photo.jpg" type="image/jpeg" length="12345" />
        <description>&lt;img src="https://example.com/photo.jpg" alt="Same photo" /&gt;</description>
      </item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items[0].images).toHaveLength(1)
    // Enclosure comes first, so alt stays empty (enclosure has no alt)
    expect(items[0].images[0].url).toBe('https://example.com/photo.jpg')
  })

  it('extracts images from Atom entries with media:content', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
      <title>Atom Feed</title>
      <entry>
        <title>Atom Image Post</title>
        <link href="https://example.com/atom-img"/>
        <id>urn:uuid:atom-img-1</id>
        <media:content url="https://example.com/atom-photo.jpg" medium="image">
          <media:description>Atom photo</media:description>
        </media:content>
        <updated>2026-01-01T00:00:00Z</updated>
      </entry>
    </feed>`
    const items = parseFeed(xml)
    expect(items[0].images).toEqual([
      { url: 'https://example.com/atom-photo.jpg', alt: 'Atom photo' },
    ])
  })

  it('extracts images from img tags in Atom content', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Feed</title>
      <entry>
        <title>Atom HTML Post</title>
        <link href="https://example.com/atom-html"/>
        <id>urn:uuid:atom-html-1</id>
        <content type="html">&lt;img src="https://example.com/atom-inline.png" alt="Atom inline" /&gt;&lt;p&gt;Content&lt;/p&gt;</content>
        <updated>2026-01-01T00:00:00Z</updated>
      </entry>
    </feed>`
    const items = parseFeed(xml)
    expect(items[0].images).toEqual([
      { url: 'https://example.com/atom-inline.png', alt: 'Atom inline' },
    ])
  })
})
