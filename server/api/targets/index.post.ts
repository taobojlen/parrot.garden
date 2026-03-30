const CREDENTIAL_SHAPES: Record<string, string[]> = {
  bluesky: ['handle', 'appPassword'],
  mastodon: [],
}

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  if (!body.name || !body.type || !body.credentials) {
    throw createError({ statusCode: 400, statusMessage: 'Name, type, and credentials are required' })
  }

  const requiredFields = CREDENTIAL_SHAPES[body.type]
  if (!requiredFields) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported target type: ${body.type}` })
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
    credentials[field] = credentials[field].trim().replace(/[\u200B-\u200D\u2028-\u202F\uFEFF]/g, '')
  }

  if (body.type === 'bluesky') {
    try {
      await verifyBlueskyCredentials({ handle: credentials.handle, appPassword: credentials.appPassword })
    }
    catch (error) {
      throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Bluesky authentication failed' })
    }
  }

  const finalCredentials: Record<string, unknown> = { ...credentials }
  if (body.type === 'bluesky') {
    finalCredentials.maxCharacters = 300
  }

  const now = new Date()
  const target = {
    id: crypto.randomUUID(),
    userId: user.id,
    type: body.type,
    name: body.name,
    credentials: JSON.stringify(finalCredentials),
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(schema.targets).values(target)
  return { ...target, credentials: undefined }
})
