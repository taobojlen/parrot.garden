import { eq, desc } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)

  const logs = await db.select({
    id: schema.postLogs.id,
    connectionId: schema.postLogs.connectionId,
    sourceName: schema.sources.name,
    targetName: schema.targets.name,
    targetType: schema.targets.type,
    itemGuid: schema.postLogs.itemGuid,
    itemTitle: schema.postLogs.itemTitle,
    itemLink: schema.postLogs.itemLink,
    status: schema.postLogs.status,
    attempts: schema.postLogs.attempts,
    error: schema.postLogs.error,
    postedAt: schema.postLogs.postedAt,
  })
    .from(schema.postLogs)
    .innerJoin(schema.connections, eq(schema.postLogs.connectionId, schema.connections.id))
    .innerJoin(schema.sources, eq(schema.connections.sourceId, schema.sources.id))
    .innerJoin(schema.targets, eq(schema.connections.targetId, schema.targets.id))
    .where(eq(schema.connections.userId, user.id))
    .orderBy(desc(schema.postLogs.postedAt))
    .limit(100)

  return logs
})
