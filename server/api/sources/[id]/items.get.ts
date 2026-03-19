import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const [source] = await db.select().from(schema.sources)
    .where(and(eq(schema.sources.id, id), eq(schema.sources.userId, user.id)))

  if (!source) throw createError({ statusCode: 404, statusMessage: 'Source not found' })

  const items = await fetchAndParseFeed(source.url)
  return items.slice(0, 5)
})
