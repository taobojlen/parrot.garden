import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ itemIndex: number }>(event)

  if (typeof body.itemIndex !== 'number' || body.itemIndex < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid item index' })
  }

  // Get connection with source and target
  const [conn] = await db.select()
    .from(schema.connections)
    .innerJoin(schema.sources, eq(schema.connections.sourceId, schema.sources.id))
    .innerJoin(schema.targets, eq(schema.connections.targetId, schema.targets.id))
    .where(and(eq(schema.connections.id, id), eq(schema.connections.userId, user.id)))

  if (!conn) throw createError({ statusCode: 404, statusMessage: 'Connection not found' })

  // Fetch feed items
  const items = await fetchAndParseFeed(conn.source.url)
  if (body.itemIndex >= items.length) {
    throw createError({ statusCode: 400, statusMessage: 'Item index out of range' })
  }

  const item = items[body.itemIndex]

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
  const credentials = JSON.parse(conn.target.credentials)
  if (conn.target.type === 'bluesky') {
    await postToBluesky(credentials, text, item.images)
  }

  return { ok: true, text }
})
