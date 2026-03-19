import { and, eq, desc, ne } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  // Verify ownership
  const [source] = await db.select().from(schema.sources)
    .where(and(eq(schema.sources.id, id), eq(schema.sources.userId, user.id)))

  if (!source) throw createError({ statusCode: 404, statusMessage: 'Source not found' })

  // Get post_log entries for all connections from this source
  const posts = await db.select({
    id: schema.postLogs.id,
    itemTitle: schema.postLogs.itemTitle,
    itemLink: schema.postLogs.itemLink,
    status: schema.postLogs.status,
    targetName: schema.targets.name,
    targetType: schema.targets.type,
    postedAt: schema.postLogs.postedAt,
  })
    .from(schema.postLogs)
    .innerJoin(schema.connections, eq(schema.postLogs.connectionId, schema.connections.id))
    .innerJoin(schema.targets, eq(schema.connections.targetId, schema.targets.id))
    .where(and(
      eq(schema.connections.sourceId, id),
      ne(schema.postLogs.status, 'skipped'),
    ))
    .orderBy(desc(schema.postLogs.postedAt))
    .limit(20)

  return posts
})
