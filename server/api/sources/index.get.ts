import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  return db.select().from(schema.sources).where(eq(schema.sources.userId, user.id))
})
