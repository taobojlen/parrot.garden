import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const [row] = await db.select({
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
    targetCredentials: schema.targets.credentials,
  })
    .from(schema.connections)
    .innerJoin(schema.sources, eq(schema.connections.sourceId, schema.sources.id))
    .innerJoin(schema.targets, eq(schema.connections.targetId, schema.targets.id))
    .where(and(eq(schema.connections.id, id), eq(schema.connections.userId, user.id)))

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Connection not found' })
  const { targetCredentials, ...connection } = row
  const maxCharacters: number = JSON.parse(targetCredentials).maxCharacters
  return { ...connection, maxCharacters }
})
