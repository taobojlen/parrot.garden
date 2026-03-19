import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const [updated] = await db.update(schema.connections)
    .set({
      ...(body.template !== undefined && { template: body.template }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.connections.id, id), eq(schema.connections.userId, user.id)))
    .returning()

  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Connection not found' })
  return updated
})
