import { XMLParser } from 'fast-xml-parser'
import { parse as parseHtml } from 'node-html-parser'

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
  processEntities: {
    maxTotalExpansions: 5000,
  },
  htmlEntities: true,
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

const RSS_USER_AGENT = 'parrot.garden/1.0 (POSSE syndication; +https://parrot.garden)'

const FEED_TIMEOUT_MS = 15_000
const MAX_FEED_BYTES = 2 * 1024 * 1024

export class FeedFetchError extends Error {
  constructor(public status: number, public retryAfter: string | null, statusText: string) {
    super(`Failed to fetch feed: ${status} ${statusText}`)
  }
}

export async function fetchFeed(url: string, validators: { etag?: string | null; lastModified?: string | null } = {}): Promise<{
  items: FeedItem[] | null
  etag: string | null
  lastModified: string | null
}> {
  const controller = new AbortController()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let timer: ReturnType<typeof setTimeout>
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Feed fetch timed out'))
      controller.abort()
    }, FEED_TIMEOUT_MS)
  })
  const request = async () => {
    const headers: Record<string, string> = { 'User-Agent': RSS_USER_AGENT }
    if (validators.etag) headers['If-None-Match'] = validators.etag
    if (validators.lastModified) headers['If-Modified-Since'] = validators.lastModified
    const response = await fetch(url, { headers, signal: controller.signal })
    reader = response.body?.getReader()
    if (response.status === 304) {
      return {
        items: null,
        etag: response.headers.get('etag') ?? validators.etag ?? null,
        lastModified: response.headers.get('last-modified') ?? validators.lastModified ?? null,
      }
    }
    if (!response.ok) {
      throw new FeedFetchError(response.status, response.headers.get('retry-after'), response.statusText)
    }
    if (Number(response.headers.get('content-length')) > MAX_FEED_BYTES) {
      throw new Error('Feed response exceeds size limit')
    }
    const decoder = new TextDecoder()
    let size = 0
    let xml = ''
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_FEED_BYTES) throw new Error('Feed response exceeds size limit')
        xml += decoder.decode(value, { stream: true })
      }
    }
    xml += decoder.decode()
    return {
      items: parseFeed(xml),
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    }
  }
  try {
    return await Promise.race([request(), deadline])
  }
  finally {
    clearTimeout(timer!)
    controller.abort()
    void reader?.cancel().catch(() => {})
  }
}

export async function fetchAndParseFeed(url: string): Promise<FeedItem[]> {
  const result = await fetchFeed(url)
  if (result.items === null) throw new Error('Unexpected 304 response without cached feed')
  return result.items
}

export type DiscoverResult =
  | { type: 'feed'; url: string }
  | { type: 'discovered'; feeds: Array<{ url: string; title: string }> }

export async function discoverFeeds(url: string): Promise<DiscoverResult> {
  const response = await fetch(url, {
    headers: { 'User-Agent': RSS_USER_AGENT },
  })
  const text = await response.text()

  try {
    parseFeed(text)
    return { type: 'feed', url }
  }
  catch {
    // Not a feed, try HTML discovery
  }

  const doc = parseHtml(text)
  const links = doc.querySelectorAll('link[rel="alternate"]')
  const feeds = links
    .filter((link) => {
      const type = link.getAttribute('type') ?? ''
      return type === 'application/rss+xml' || type === 'application/atom+xml'
    })
    .map((link) => {
      const href = link.getAttribute('href') ?? ''
      const resolvedUrl = new URL(href, url).toString()
      const title = link.getAttribute('title') || resolvedUrl
      return { url: resolvedUrl, title }
    })

  if (feeds.length === 0) {
    throw new Error('No RSS feeds found on this page')
  }

  return { type: 'discovered', feeds }
}
