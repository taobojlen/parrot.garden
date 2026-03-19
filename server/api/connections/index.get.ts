import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)

  const results = await db.select({
    id: schema.connections.id,
    sourceId: schema.connections.sourceId,
    sourceName: schema.sources.name,
    sourceUrl: schema.sources.url,
    targetId: schema.connections.targetId,
    targetName: schema.targets.name,
    targetType: schema.targets.type,
    template: schema.connections.template,
    enabled: schema.connections.enabled,
    createdAt: schema.connections.createdAt,
  })
    .from(schema.connections)
    .innerJoin(schema.sources, eq(schema.connections.sourceId, schema.sources.id))
    .innerJoin(schema.targets, eq(schema.connections.targetId, schema.targets.id))
    .where(eq(schema.connections.userId, user.id))

  return results
})
