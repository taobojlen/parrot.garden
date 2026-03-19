import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const [deleted] = await db.delete(schema.connections)
    .where(and(eq(schema.connections.id, id), eq(schema.connections.userId, user.id)))
    .returning()

  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Connection not found' })
  return { ok: true }
})
