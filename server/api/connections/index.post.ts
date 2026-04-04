import { and, eq } from 'drizzle-orm'

const DEFAULT_TEMPLATES: Record<string, string> = {
  bluesky: '{{title}} {{link}}',
}

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  if (!body.sourceId || !body.targetId) {
    throw createError({ statusCode: 400, statusMessage: 'sourceId and targetId are required' })
  }

  // Verify ownership of source and target
  const [source] = await db.select().from(schema.sources)
    .where(and(eq(schema.sources.id, body.sourceId), eq(schema.sources.userId, user.id)))
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Source not found' })

  const [target] = await db.select().from(schema.targets)
    .where(and(eq(schema.targets.id, body.targetId), eq(schema.targets.userId, user.id)))
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Target not found' })

  const now = new Date()
  const connection = {
    id: crypto.randomUUID(),
    userId: user.id,
    sourceId: body.sourceId,
    targetId: body.targetId,
    template: body.template || DEFAULT_TEMPLATES[target.type] || '{{title}} {{link}}',
    includeImages: body.includeImages ?? false,
    truncateWithLink: body.truncateWithLink ?? false,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(schema.connections).values(connection)

  return connection
})
