import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  // Get connection with source and target
  const [conn] = await db.select()
    .from(schema.connections)
    .innerJoin(schema.sources, eq(schema.connections.sourceId, schema.sources.id))
    .innerJoin(schema.targets, eq(schema.connections.targetId, schema.targets.id))
    .where(and(eq(schema.connections.id, id), eq(schema.connections.userId, user.id)))

  if (!conn) throw createError({ statusCode: 404, statusMessage: 'Connection not found' })

  // Fetch the most recent feed item
  const items = await fetchAndParseFeed(conn.source.url)
  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: 'No items in feed' })
  }

  const item = items[0]!

  // Render template
  const { maxCharacters, urlCost } = getPostOptions(conn.target)

  let rendered = renderTemplate(conn.connection.template, {
    title: item.title,
    link: item.link,
    description: item.description,
    content: item.content,
    author: item.author,
    date: item.pubDate,
  })

  if (conn.connection.truncateWithLink && graphemeLength(rendered) > maxCharacters) {
    rendered = rendered + '\n\n' + item.link
  }

  const text = truncatePost(
    rendered,
    maxCharacters,
    urlCost !== undefined ? { urlCost } : undefined,
  )

  // Post to target
  const credentials = JSON.parse(conn.target.credentials)
  if (conn.target.type === 'bluesky') {
    await postToBluesky(credentials, text, conn.connection.includeImages ? item.images : undefined)
  } else if (conn.target.type === 'mastodon') {
    await postToMastodon(credentials, text, conn.connection.includeImages ? item.images : undefined)
  }

  return { ok: true, text }
})
