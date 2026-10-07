import { eq } from 'drizzle-orm'
import { processConnectionItems, filterNewItems, feedRetryAt, type ExistingLog } from '../../utils/poll'
import { chunk, D1_BATCH_SIZE, SOURCE_ITEM_BATCH_SIZE } from '../../utils/batch'
import { fetchFeed, FeedFetchError } from '../../utils/rss'

const MAX_ITEMS_PER_FEED = 10

export default defineTask({
  meta: {
    name: 'feed:poll',
    description: 'Poll RSS feeds and post new items to targets',
  },
  async run() {
    // 1. Get all enabled connections with their sources and targets
    const activeConnections = await db.select()
      .from(schema.connections)
      .innerJoin(schema.sources, eq(schema.connections.sourceId, schema.sources.id))
      .innerJoin(schema.targets, eq(schema.connections.targetId, schema.targets.id))
      .where(eq(schema.connections.enabled, true))

    if (!activeConnections.length) return { result: 'No active connections' }

    // 2. Group by source URL to avoid fetching the same feed twice
    const feedsByUrl = new Map<string, typeof activeConnections>()
    for (const conn of activeConnections) {
      const url = conn.source.url
      if (!feedsByUrl.has(url)) feedsByUrl.set(url, [])
      feedsByUrl.get(url)!.push(conn)
    }

    // 3. Fetch feeds and process
    let posted = 0
    let failed = 0
    let skipped = 0

    for (const [url, connections] of feedsByUrl) {
      const [state] = await db.select().from(schema.feedPollState)
        .where(eq(schema.feedPollState.url, url))
      if (state?.nextPollAt && state.nextPollAt > new Date()) continue

      let items
      let fetched
      try {
        fetched = await fetchFeed(url, state?.items ? state : undefined)
        items = fetched.items ?? state?.items
        if (!items) throw new Error('Unexpected 304 response without cached feed')
      }
      catch (e) {
        const failures = (state?.failures ?? 0) + 1
        const nextPollAt = feedRetryAt(new Date(), failures, e instanceof FeedFetchError ? e.retryAfter : null)
        await db.insert(schema.feedPollState).values({ url, failures, nextPollAt })
          .onConflictDoUpdate({ target: schema.feedPollState.url, set: { failures, nextPollAt } })
        console.error(`Failed to fetch feed ${url}:`, e)
        continue
      }

      items = items.slice(0, MAX_ITEMS_PER_FEED)
      const fetchState = { etag: fetched.etag, lastModified: fetched.lastModified, items, failures: 0, nextPollAt: null }
      await db.insert(schema.feedPollState).values({ url, ...fetchState })
        .onConflictDoUpdate({ target: schema.feedPollState.url, set: fetchState })

      // Upsert items into source_items (preserves original createdAt via onConflictDoNothing)
      const sourceId = connections[0]!.source.id
      const now = new Date()
      for (const batch of chunk(items, SOURCE_ITEM_BATCH_SIZE)) {
        await db.insert(schema.sourceItems).values(batch.map(item => ({
          id: crypto.randomUUID(),
          sourceId,
          itemGuid: item.guid,
          createdAt: now,
        }))).onConflictDoNothing()
      }

      // Read back first-seen dates for filtering
      const sourceItemRows = await db.select({
        itemGuid: schema.sourceItems.itemGuid,
        createdAt: schema.sourceItems.createdAt,
      })
        .from(schema.sourceItems)
        .where(eq(schema.sourceItems.sourceId, sourceId))
      const sourceItemDates = new Map(sourceItemRows.map(r => [r.itemGuid, r.createdAt]))

      for (const conn of connections) {
        const connectionId = conn.connection.id
        const target = conn.target

        // Only process items discovered after this connection was created
        const newItems = filterNewItems(items, sourceItemDates, conn.connection.createdAt)

        // Check which items already have post_log entries
        const existingLogs = await db.select({
          itemGuid: schema.postLogs.itemGuid,
          status: schema.postLogs.status,
          attempts: schema.postLogs.attempts,
          id: schema.postLogs.id,
          firstFailedAt: schema.postLogs.firstFailedAt,
          nextRetryAt: schema.postLogs.nextRetryAt,
        })
          .from(schema.postLogs)
          .where(eq(schema.postLogs.connectionId, connectionId))

        const existingGuids = new Map<string, ExistingLog>(existingLogs.map((l: ExistingLog) => [l.itemGuid, l]))

        const { maxCharacters, urlCost } = getPostOptions(target)

        const result = await processConnectionItems({
          items: newItems,
          existingLogs: existingGuids,
          connectionId,
          template: conn.connection.template,
          includeImages: conn.connection.includeImages,
          truncateWithLink: conn.connection.truncateWithLink,
          target: { type: target.type, credentials: target.credentials },
          maxCharacters,
          urlCost,
          postFn: async (credentials, text, images) => {
            if (target.type === 'bluesky') {
              await postToBluesky(credentials, text, images)
            } else if (target.type === 'mastodon') {
              await postToMastodon(credentials, text, images)
            }
          },
          claimFn: async (row) => {
            try {
              await db.insert(schema.postLogs).values(row)
              return true
            } catch {
              return false
            }
          },
        })

        // Batch-insert new post_log rows
        for (const batch of chunk(result.newRows, D1_BATCH_SIZE)) {
          await db.insert(schema.postLogs).values(batch).onConflictDoNothing()
        }

        // Apply updates to existing rows
        for (const update of result.updates) {
          await db.update(schema.postLogs)
            .set(update.set)
            .where(eq(schema.postLogs.id, update.id))
        }

        posted += result.posted
        failed += result.failed
        skipped += result.skipped
      }
    }

    return { result: `Posted: ${posted}, Failed: ${failed}, Skipped: ${skipped}` }
  },
})
