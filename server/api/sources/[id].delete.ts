import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const [deleted] = await db.delete(schema.sources)
    .where(and(eq(schema.sources.id, id), eq(schema.sources.userId, user.id)))
    .returning()

  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Source not found' })
  return { ok: true }
})
