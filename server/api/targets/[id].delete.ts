import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const [deleted] = await db.delete(schema.targets)
    .where(and(eq(schema.targets.id, id), eq(schema.targets.userId, user.id)))
    .returning()

  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Target not found' })
  return { ok: true }
})
