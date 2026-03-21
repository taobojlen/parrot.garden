import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody<{ instanceUrl: string; targetName: string }>(event)

  if (!body.instanceUrl || !body.targetName) {
    throw createError({ statusCode: 400, statusMessage: 'instanceUrl and targetName are required' })
  }

  const instanceUrl = normalizeInstanceUrl(body.instanceUrl)

  // Verify instance is reachable
  const instanceCheck = await fetch(`https://${instanceUrl}/api/v1/instance`)
  if (!instanceCheck.ok) {
    throw createError({ statusCode: 400, statusMessage: `Cannot reach Mastodon instance: ${instanceUrl}` })
  }

  // Get or create app registration
  const redirectUri = `${getBaseURL()}/api/targets/mastodon/callback`

  let app = await db.select()
    .from(schema.mastodonApps)
    .where(eq(schema.mastodonApps.instanceUrl, instanceUrl))
    .then(rows => rows[0])

  if (!app) {
    const registered = await registerMastodonApp(instanceUrl, redirectUri)
    app = {
      id: crypto.randomUUID(),
      instanceUrl,
      clientId: registered.clientId,
      clientSecret: registered.clientSecret,
      createdAt: new Date(),
    }
    await db.insert(schema.mastodonApps).values(app)
  }

  // Create OAuth state for CSRF protection
  const nonce = crypto.randomUUID()
  await db.insert(schema.mastodonOauthState).values({
    id: crypto.randomUUID(),
    nonce,
    userId: user.id,
    createdAt: new Date(),
  })

  const state = btoa(JSON.stringify({ nonce, targetName: body.targetName, instanceUrl }))

  const authUrl = `https://${instanceUrl}/oauth/authorize?` + new URLSearchParams({
    client_id: app.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'write:statuses write:media',
    state,
  }).toString()

  return { url: authUrl }
})
