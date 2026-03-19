import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const rows = await db.select({
    id: schema.targets.id,
    userId: schema.targets.userId,
    type: schema.targets.type,
    name: schema.targets.name,
    createdAt: schema.targets.createdAt,
    updatedAt: schema.targets.updatedAt,
  }).from(schema.targets).where(eq(schema.targets.userId, user.id))
  return rows
})
