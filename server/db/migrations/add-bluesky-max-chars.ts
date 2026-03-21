import { eq } from 'drizzle-orm'

export async function migrateBlueskyMaxChars(db: any, schema: any) {
  const targets = await db.select({
    id: schema.targets.id,
    credentials: schema.targets.credentials,
  })
    .from(schema.targets)
    .where(eq(schema.targets.type, 'bluesky'))

  for (const target of targets) {
    const creds = JSON.parse(target.credentials)
    if (creds.maxCharacters !== undefined) continue
    creds.maxCharacters = 300
    await db.update(schema.targets)
      .set({ credentials: JSON.stringify(creds), updatedAt: new Date() })
      .where(eq(schema.targets.id, target.id))
  }
}
