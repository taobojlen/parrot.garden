import { eq } from 'drizzle-orm'
import { processConnectionItems, type ExistingLog } from '../../utils/poll'
import { chunk, D1_BATCH_SIZE } from '../../utils/batch'

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
      let items
      try {
        items = await fetchAndParseFeed(url)
      }
      catch (e) {
        console.error(`Failed to fetch feed ${url}:`, e)
        continue
      }

      items = items.slice(0, MAX_ITEMS_PER_FEED)

      for (const conn of connections) {
        const connectionId = conn.connection.id
        const target = conn.target

        // Check which items already have post_log entries
        const existingLogs = await db.select({
          itemGuid: schema.postLogs.itemGuid,
          status: schema.postLogs.status,
          attempts: schema.postLogs.attempts,
          id: schema.postLogs.id,
        })
          .from(schema.postLogs)
          .where(eq(schema.postLogs.connectionId, connectionId))

        const existingGuids = new Map<string, ExistingLog>(existingLogs.map((l: ExistingLog) => [l.itemGuid, l]))

        const result = await processConnectionItems({
          items,
          existingLogs: existingGuids,
          connectionId,
          template: conn.connection.template,
          includeImages: conn.connection.includeImages,
          target: { type: target.type, credentials: target.credentials },
          postFn: async (credentials, text, images) => {
            if (target.type === 'bluesky') {
              await postToBluesky(credentials, text, images)
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
