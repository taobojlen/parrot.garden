import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const [connection] = await db.select({
    id: schema.connections.id,
    sourceId: schema.connections.sourceId,
    sourceName: schema.sources.name,
    sourceUrl: schema.sources.url,
    targetId: schema.connections.targetId,
    targetName: schema.targets.name,
    targetType: schema.targets.type,
    template: schema.connections.template,
    includeImages: schema.connections.includeImages,
    enabled: schema.connections.enabled,
    createdAt: schema.connections.createdAt,
  })
    .from(schema.connections)
    .innerJoin(schema.sources, eq(schema.connections.sourceId, schema.sources.id))
    .innerJoin(schema.targets, eq(schema.connections.targetId, schema.targets.id))
    .where(and(eq(schema.connections.id, id), eq(schema.connections.userId, user.id)))

  if (!connection) throw createError({ statusCode: 404, statusMessage: 'Connection not found' })
  return connection
})
