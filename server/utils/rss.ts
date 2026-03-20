import { XMLParser } from 'fast-xml-parser'

export interface FeedImage {
  url: string
  alt: string
}

export interface FeedItem {
  guid: string
  title: string
  link: string
  description: string
  content: string
  author: string
  pubDate: string // ISO 8601
  images: FeedImage[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: true,
  htmlEntities: true,
  entityExpansionLimit: 5000,
})

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&') // Must be last
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)')
    .trim()
}

const MAX_IMAGES = 4

function extractImagesFromHtml(html: string): FeedImage[] {
  if (!html) return []
  const decoded = String(html)
  const images: FeedImage[] = []
  const imgRegex = /<img\s[^>]*?src=["']([^"']+)["'][^>]*?>/gi
  let match
  while ((match = imgRegex.exec(decoded)) !== null) {
    const url = decodeHtmlEntities(match[1] ?? '')
    const altMatch = match[0].match(/alt=["'](.*?)["'](?=[\s/>])/)
    images.push({ url, alt: altMatch ? decodeHtmlEntities(altMatch[1] ?? '') : '' })
  }
  return images
}

function extractImagesFromEnclosures(item: any): FeedImage[] {
  const enclosures = Array.isArray(item.enclosure) ? item.enclosure : item.enclosure ? [item.enclosure] : []
  return enclosures
    .filter((e: any) => {
      const type = e['@_type'] ?? ''
      return type.startsWith('image/')
    })
    .map((e: any) => ({ url: e['@_url'] ?? '', alt: '' }))
}

function extractImagesFromMedia(item: any): FeedImage[] {
  const mediaContent = Array.isArray(item['media:content']) ? item['media:content'] : item['media:content'] ? [item['media:content']] : []
  return mediaContent
    .filter((m: any) => {
      const medium = m['@_medium'] ?? ''
      const type = m['@_type'] ?? ''
      return medium === 'image' || type.startsWith('image/')
    })
    .map((m: any) => ({
      url: m['@_url'] ?? '',
      alt: m['media:description']
        ? String(m['media:description']?.['#text'] ?? m['media:description'] ?? '')
        : '',
    }))
}

function collectImages(item: any, ...htmlFields: string[]): FeedImage[] {
  const seen = new Set<string>()
  const images: FeedImage[] = []

  function add(list: FeedImage[]) {
    for (const img of list) {
      if (!img.url || seen.has(img.url)) continue
      seen.add(img.url)
      images.push(img)
    }
  }

  add(extractImagesFromEnclosures(item))
  add(extractImagesFromMedia(item))
  for (const field of htmlFields) {
    const val = item[field]
    if (!val) continue
    const raw = typeof val === 'object' ? String(val['#text'] ?? val) : String(val)
    add(extractImagesFromHtml(raw))
  }

  return images.slice(0, MAX_IMAGES)
}

function toISODate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toISOString().split('T')[0] ?? ''
  }
  catch {
    return ''
  }
}

function parseRssItems(channel: any): FeedItem[] {
  const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : []
  return items.map((item: any) => ({
    guid: item.guid?.['#text'] ?? item.guid ?? item.link ?? '',
    title: String(item.title ?? ''),
    link: item.link ?? '',
    description: item.description ? stripHtml(String(item.description)) : '',
    content: item['content:encoded'] ? stripHtml(String(item['content:encoded'])) : '',
    author: String(item.author ?? item['dc:creator'] ?? ''),
    pubDate: toISODate(item.pubDate),
    images: collectImages(item, 'description', 'content:encoded'),
  }))
}

function parseAtomEntries(feed: any): FeedItem[] {
  const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : []
  return entries.map((entry: any) => {
    const link = Array.isArray(entry.link)
      ? entry.link.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel'])?.['@_href']
      : entry.link?.['@_href'] ?? entry.link ?? ''
    const contentRaw = entry.content?.['#text'] ?? entry.content ?? ''
    const summaryRaw = entry.summary?.['#text'] ?? entry.summary ?? ''
    return {
      guid: entry.id ?? link ?? '',
      title: String(entry.title?.['#text'] ?? entry.title ?? ''),
      link,
      description: entry.summary ? stripHtml(String(summaryRaw)) : '',
      content: entry.content ? stripHtml(String(contentRaw)) : '',
      author: String(entry.author?.name ?? ''),
      pubDate: toISODate(entry.updated ?? entry.published),
      images: collectImages(entry, 'content', 'summary'),
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
