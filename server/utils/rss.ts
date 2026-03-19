import { XMLParser } from 'fast-xml-parser'

export interface FeedItem {
  guid: string
  title: string
  link: string
  description: string
  content: string
  author: string
  pubDate: string // ISO 8601
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: false, // We handle entity decoding manually to avoid double-decoding
})

function decodeEntitiesOnce(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&') // Must be last to avoid double-decoding
}

function decodeEntities(text: string): string {
  // Decode twice to handle double-encoded entities (e.g. &amp;gt; → &gt; → >)
  return decodeEntitiesOnce(decodeEntitiesOnce(text))
}

function stripHtml(html: string): string {
  return decodeEntities(html)
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)')
    .trim()
}

function toISODate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toISOString().split('T')[0]
  }
  catch {
    return ''
  }
}

function parseRssItems(channel: any): FeedItem[] {
  const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : []
  return items.map((item: any) => ({
    guid: item.guid?.['#text'] ?? item.guid ?? item.link ?? '',
    title: decodeEntities(String(item.title ?? '')),
    link: item.link ?? '',
    description: item.description ? stripHtml(String(item.description)) : '',
    content: item['content:encoded'] ? stripHtml(String(item['content:encoded'])) : '',
    author: decodeEntities(String(item.author ?? item['dc:creator'] ?? '')),
    pubDate: toISODate(item.pubDate),
  }))
}

function parseAtomEntries(feed: any): FeedItem[] {
  const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : []
  return entries.map((entry: any) => {
    const link = Array.isArray(entry.link)
      ? entry.link.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel'])?.['@_href']
      : entry.link?.['@_href'] ?? entry.link ?? ''
    return {
      guid: entry.id ?? link ?? '',
      title: decodeEntities(String(entry.title?.['#text'] ?? entry.title ?? '')),
      link,
      description: entry.summary ? stripHtml(String(entry.summary?.['#text'] ?? entry.summary)) : '',
      content: entry.content ? stripHtml(String(entry.content?.['#text'] ?? entry.content)) : '',
      author: decodeEntities(String(entry.author?.name ?? '')),
      pubDate: toISODate(entry.updated ?? entry.published),
    }
  })
}

export function parseFeed(xml: string): FeedItem[] {
  const parsed = parser.parse(xml)

  let items: FeedItem[]
  if (parsed.rss?.channel) {
    items = parseRssItems(parsed.rss.channel)
  }
  else if (parsed.feed) {
    items = parseAtomEntries(parsed.feed)
  }
  else {
    throw new Error('Unrecognized feed format: not RSS 2.0 or Atom')
  }

  return items.sort((a, b) => {
    if (!a.pubDate) return 1
    if (!b.pubDate) return -1
    return b.pubDate.localeCompare(a.pubDate)
  })
}

export async function fetchAndParseFeed(url: string): Promise<FeedItem[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`)
  }
  const xml = await response.text()
  return parseFeed(xml)
}
