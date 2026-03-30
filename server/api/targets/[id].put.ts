import { and, eq } from 'drizzle-orm'

const CREDENTIAL_SHAPES: Record<string, string[]> = {
  bluesky: ['handle', 'appPassword'],
  mastodon: [],
}

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  let credentialsJson: string | undefined
  if (body.credentials !== undefined) {
    const type = body.type ?? (
      await db.select({ type: schema.targets.type }).from(schema.targets)
        .where(and(eq(schema.targets.id, id), eq(schema.targets.userId, user.id)))
        .then((rows: { type: string }[]) => rows[0]?.type)
    )

    if (!type) throw createError({ statusCode: 404, statusMessage: 'Target not found' })

    const requiredFields = CREDENTIAL_SHAPES[type]
    if (!requiredFields) {
      throw createError({ statusCode: 400, statusMessage: `Unsupported target type: ${type}` })
    }

    let credentials: Record<string, string>
    try {
      credentials = typeof body.credentials === 'string' ? JSON.parse(body.credentials) : body.credentials
    }
    catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid credentials JSON' })
    }

    for (const field of requiredFields) {
      if (!credentials[field]) {
        throw createError({ statusCode: 400, statusMessage: `Missing credential: ${field}` })
      }
    }

    if (type === 'bluesky') {
      try {
        await verifyBlueskyCredentials({ handle: credentials.handle, appPassword: credentials.appPassword })
      }
      catch (error) {
        throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Bluesky authentication failed' })
      }
    }

    const finalCredentials: Record<string, unknown> = { ...credentials }
    if (type === 'bluesky') {
      finalCredentials.maxCharacters = 300
    }
    credentialsJson = JSON.stringify(finalCredentials)
  }

  const [updated] = await db.update(schema.targets)
    .set({
      ...(body.name && { name: body.name }),
      ...(body.type && { type: body.type }),
      ...(credentialsJson !== undefined && { credentials: credentialsJson }),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.targets.id, id), eq(schema.targets.userId, user.id)))
    .returning({
      id: schema.targets.id,
      userId: schema.targets.userId,
      type: schema.targets.type,
      name: schema.targets.name,
      createdAt: schema.targets.createdAt,
      updatedAt: schema.targets.updatedAt,
    })

  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Target not found' })
  return updated
})
