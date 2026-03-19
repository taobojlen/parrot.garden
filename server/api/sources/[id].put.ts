import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  if (body.url) {
    try {
      await fetchAndParseFeed(body.url)
    }
    catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: `Invalid RSS feed: ${e.message}` })
    }
  }

  const [updated] = await db.update(schema.sources)
    .set({
      ...(body.name && { name: body.name }),
      ...(body.url && { url: body.url }),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.sources.id, id), eq(schema.sources.userId, user.id)))
    .returning()

  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Source not found' })
  return updated
})
