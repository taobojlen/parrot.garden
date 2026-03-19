import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const [target] = await db.select({
    id: schema.targets.id,
    userId: schema.targets.userId,
    type: schema.targets.type,
    name: schema.targets.name,
    createdAt: schema.targets.createdAt,
    updatedAt: schema.targets.updatedAt,
  }).from(schema.targets)
    .where(and(eq(schema.targets.id, id), eq(schema.targets.userId, user.id)))

  if (!target) throw createError({ statusCode: 404, statusMessage: 'Target not found' })
  return target
})
