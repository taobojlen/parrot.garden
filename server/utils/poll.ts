import { renderTemplate, truncatePost, graphemeLength } from './template'
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

const MIN_MS = 60 * 1000
const BASE_DELAY_MIN = 5
const MAX_DELAY_MIN = 60
const ABANDON_AFTER_MS = 24 * 60 * MIN_MS

// Delay before next retry, in minutes. `attempts` is the count including the failure
// that just occurred: 1 → 5m, 2 → 10m, 3 → 20m, 4 → 40m, 5+ → 60m (capped).
export function backoffDelayMinutes(attempts: number): number {
  const exponential = BASE_DELAY_MIN * 2 ** (attempts - 1)
  return Math.min(exponential, MAX_DELAY_MIN)
}

export function computeRetrySchedule(opts: {
  now: Date
  attempts: number
  existingFirstFailedAt: Date | null
  isPermanent: boolean
}): { firstFailedAt: Date; nextRetryAt: Date | null } {
  const firstFailedAt = opts.existingFirstFailedAt ?? opts.now
  const abandoned = opts.isPermanent
    || (opts.now.getTime() - firstFailedAt.getTime() >= ABANDON_AFTER_MS)
  const nextRetryAt = abandoned
    ? null
    : new Date(opts.now.getTime() + backoffDelayMinutes(opts.attempts) * MIN_MS)
  return { firstFailedAt, nextRetryAt }
}

export interface ExistingLog {
  id: string
  itemGuid: string
  status: string
  attempts: number
  firstFailedAt: Date | null
  nextRetryAt: Date | null
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
  firstFailedAt: Date | null
  nextRetryAt: Date | null
  postedAt: Date
  updatedAt: Date
}

export interface PostLogUpdate {
  id: string
  set: {
    status: string
    error: string | null
    attempts?: number
    firstFailedAt?: Date | null
    nextRetryAt?: Date | null
    updatedAt: Date
  }
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
  truncateWithLink?: boolean
  target: { type: string; credentials: string }
  maxCharacters: number
  urlCost?: number
  postFn: (credentials: any, text: string, images?: FeedImage[]) => Promise<void>
  claimFn?: (row: PostLogRow) => Promise<boolean>
}): Promise<ProcessResult> {
  const { items, existingLogs, connectionId, template, includeImages, target, postFn, claimFn } = opts
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

    if (existing && existing.status === 'failed') {
      // Abandoned (permanent or exhausted) — nothing to retry.
      if (existing.nextRetryAt === null) {
        skipped++
        continue
      }
      // Not due yet.
      if (existing.nextRetryAt > now) {
        skipped++
        continue
      }
    }

    let rendered = renderTemplate(template, {
      title: item.title,
      link: item.link,
      description: item.description,
      content: item.content,
      author: item.author,
      date: item.pubDate,
    })

    if (opts.truncateWithLink && graphemeLength(rendered) > opts.maxCharacters) {
      rendered = rendered + '\n\n' + item.link
    }

    const text = truncatePost(
      rendered,
      opts.maxCharacters,
      opts.urlCost !== undefined ? { urlCost: opts.urlCost } : undefined,
    )

    // For new items with claimFn, atomically claim before posting
    let claimedId: string | undefined
    if (!existing && claimFn) {
      const row: PostLogRow = {
        id: crypto.randomUUID(),
        connectionId,
        itemGuid: item.guid,
        itemTitle: item.title,
        itemLink: item.link,
        itemDescription: item.description,
        itemContent: item.content,
        itemAuthor: item.author,
        itemPubDate: item.pubDate,
        status: 'pending',
        attempts: 0,
        error: null,
        firstFailedAt: null,
        nextRetryAt: null,
        postedAt: now,
        updatedAt: now,
      }
      const claimed = await claimFn(row)
      if (!claimed) {
        skipped++
        continue
      }
      claimedId = row.id
    }

    try {
      const credentials = JSON.parse(target.credentials)
      await postFn(credentials, text, includeImages ? item.images : undefined)

      if (existing) {
        updates.push({
          id: existing.id,
          set: {
            status: 'posted',
            error: null,
            firstFailedAt: null,
            nextRetryAt: null,
            updatedAt: now,
          },
        })
      } else if (claimedId) {
        updates.push({
          id: claimedId,
          set: {
            status: 'posted',
            error: null,
            attempts: 1,
            firstFailedAt: null,
            nextRetryAt: null,
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
          status: 'posted',
          attempts: 1,
          error: null,
          firstFailedAt: null,
          nextRetryAt: null,
          postedAt: now,
          updatedAt: now,
        })
      }
      posted++
    } catch (e: any) {
      const isPermanent = e.status === 401 || e.status === 400
      const attempts = (existing?.attempts ?? 0) + 1
      const { firstFailedAt, nextRetryAt } = computeRetrySchedule({
        now,
        attempts,
        existingFirstFailedAt: existing?.firstFailedAt ?? null,
        isPermanent,
      })

      if (existing) {
        updates.push({
          id: existing.id,
          set: {
            status: 'failed',
            error: e.message,
            attempts,
            firstFailedAt,
            nextRetryAt,
            updatedAt: now,
          },
        })
      } else if (claimedId) {
        updates.push({
          id: claimedId,
          set: {
            status: 'failed',
            error: e.message,
            attempts: 1,
            firstFailedAt,
            nextRetryAt,
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
          attempts: 1,
          error: e.message,
          firstFailedAt,
          nextRetryAt,
          postedAt: now,
          updatedAt: now,
        })
      }
      failed++
    }
  }

  return { newRows, updates, posted, failed, skipped }
}
