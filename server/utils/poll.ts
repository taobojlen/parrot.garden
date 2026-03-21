import { renderTemplate, truncatePost } from './template'
import type { FeedItem, FeedImage } from './rss'

export function filterNewItems(
  items: FeedItem[],
  sourceItemDates: Map<string, Date>,
  connectionCreatedAt: Date,
): FeedItem[] {
  return items.filter((item) => {
    const firstSeen = sourceItemDates.get(item.guid)
    if (!firstSeen) return true
    return firstSeen > connectionCreatedAt
  })
}

const MAX_RETRY_ATTEMPTS = 5

export interface ExistingLog {
  id: string
  itemGuid: string
  status: string
  attempts: number
}

export interface PostLogRow {
  id: string
  connectionId: string
  itemGuid: string
  itemTitle: string
  itemLink: string
  itemDescription: string
  itemContent: string
  itemAuthor: string
  itemPubDate: string
  status: string
  attempts: number
  error: string | null
  postedAt: Date
  updatedAt: Date
}

export interface PostLogUpdate {
  id: string
  set: { status: string; error: string | null; attempts?: number; updatedAt: Date }
}

export interface ProcessResult {
  newRows: PostLogRow[]
  updates: PostLogUpdate[]
  posted: number
  failed: number
  skipped: number
}

export async function processConnectionItems(opts: {
  items: FeedItem[]
  existingLogs: Map<string, ExistingLog>
  connectionId: string
  template: string
  includeImages: boolean
  target: { type: string; credentials: string }
  maxCharacters: number
  urlCost?: number
  postFn: (credentials: any, text: string, images?: FeedImage[]) => Promise<void>
}): Promise<ProcessResult> {
  const { items, existingLogs, connectionId, template, includeImages, target, postFn } = opts
  const newRows: PostLogRow[] = []
  const updates: PostLogUpdate[] = []
  let posted = 0
  let failed = 0
  let skipped = 0
  const now = new Date()

  for (const item of items) {
    const existing = existingLogs.get(item.guid)

    if (existing && (existing.status === 'posted' || existing.status === 'skipped')) {
      skipped++
      continue
    }

    if (existing && existing.status === 'failed' && existing.attempts >= MAX_RETRY_ATTEMPTS) {
      skipped++
      continue
    }

    const text = truncatePost(
      renderTemplate(template, {
        title: item.title,
        link: item.link,
        description: item.description,
        content: item.content,
        author: item.author,
        date: item.pubDate,
      }),
      opts.maxCharacters,
      opts.urlCost !== undefined ? { urlCost: opts.urlCost } : undefined,
    )

    try {
      const credentials = JSON.parse(target.credentials)
      await postFn(credentials, text, includeImages ? item.images : undefined)

      if (existing) {
        updates.push({
          id: existing.id,
          set: { status: 'posted', error: null, updatedAt: now },
        })
      } else {
        newRows.push({
          id: crypto.randomUUID(),
          connectionId,
          itemGuid: item.guid,
          itemTitle: item.title,
          itemLink: item.link,
          itemDescription: item.description,
          itemContent: item.content,
          itemAuthor: item.author,
          itemPubDate: item.pubDate,
          status: 'posted',
          attempts: 1,
          error: null,
          postedAt: now,
          updatedAt: now,
        })
      }
      posted++
    } catch (e: any) {
      const isPermanent = e.status === 401 || e.status === 400
      const attempts = (existing?.attempts ?? 0) + 1

      if (existing) {
        updates.push({
          id: existing.id,
          set: {
            status: 'failed',
            error: e.message,
            attempts: isPermanent ? MAX_RETRY_ATTEMPTS : attempts,
            updatedAt: now,
          },
        })
      } else {
        newRows.push({
          id: crypto.randomUUID(),
          connectionId,
          itemGuid: item.guid,
          itemTitle: item.title,
          itemLink: item.link,
          itemDescription: item.description,
          itemContent: item.content,
          itemAuthor: item.author,
          itemPubDate: item.pubDate,
          status: 'failed',
          attempts: isPermanent ? MAX_RETRY_ATTEMPTS : 1,
          error: e.message,
          postedAt: now,
          updatedAt: now,
        })
      }
      failed++
    }
  }

  return { newRows, updates, posted, failed, skipped }
}
