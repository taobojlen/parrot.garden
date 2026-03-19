import { eq } from 'drizzle-orm'

const MAX_ITEMS_PER_FEED = 10
const MAX_RETRY_ATTEMPTS = 5

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

        const existingGuids = new Map(existingLogs.map(l => [l.itemGuid, l]))

        for (const item of items) {
          const existing = existingGuids.get(item.guid)

          // Skip if already posted or skipped
          if (existing && (existing.status === 'posted' || existing.status === 'skipped')) {
            skipped++
            continue
          }

          // Skip if failed and exceeded max attempts
          if (existing && existing.status === 'failed' && existing.attempts >= MAX_RETRY_ATTEMPTS) {
            skipped++
            continue
          }

          // Render template
          const text = truncatePost(
            renderTemplate(conn.connection.template, {
              title: item.title,
              link: item.link,
              description: item.description,
              content: item.content,
              author: item.author,
              date: item.pubDate,
            }),
            300,
          )

          // Post to target
          try {
            const credentials = JSON.parse(target.credentials)
            if (target.type === 'bluesky') {
              await postToBluesky(credentials, text)
            }

            if (existing) {
              await db.update(schema.postLogs)
                .set({ status: 'posted', error: null, updatedAt: new Date() })
                .where(eq(schema.postLogs.id, existing.id))
            }
            else {
              await db.insert(schema.postLogs).values({
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
                postedAt: new Date(),
                updatedAt: new Date(),
              })
            }
            posted++
          }
          catch (e: any) {
            const isPermanent = e.status === 401 || e.status === 400
            const attempts = (existing?.attempts ?? 0) + 1

            if (existing) {
              await db.update(schema.postLogs)
                .set({
                  status: 'failed',
                  error: e.message,
                  attempts: isPermanent ? MAX_RETRY_ATTEMPTS : attempts,
                  updatedAt: new Date(),
                })
                .where(eq(schema.postLogs.id, existing.id))
            }
            else {
              await db.insert(schema.postLogs).values({
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
                postedAt: new Date(),
                updatedAt: new Date(),
              })
            }
            failed++
          }
        }
      }
    }

    return { result: `Posted: ${posted}, Failed: ${failed}, Skipped: ${skipped}` }
  },
})
