import { and, eq, lt } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  const code = query.code as string
  const stateParam = query.state as string

  if (!code || !stateParam) {
    throw createError({ statusCode: 400, statusMessage: 'Missing code or state parameter' })
  }

  // Parse and verify state
  let state: { nonce: string; targetName: string; instanceUrl: string }
  try {
    const padded = stateParam.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - stateParam.length % 4) % 4)
    state = JSON.parse(atob(padded))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid state parameter' })
  }

  // Clean up expired states (older than 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  await db.delete(schema.mastodonOauthState)
    .where(lt(schema.mastodonOauthState.createdAt, tenMinutesAgo))

  // Verify nonce
  const [oauthState] = await db.select()
    .from(schema.mastodonOauthState)
    .where(and(
      eq(schema.mastodonOauthState.nonce, state.nonce),
      eq(schema.mastodonOauthState.userId, user.id),
    ))

  if (!oauthState) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired OAuth state' })
  }

  // Delete used nonce
  await db.delete(schema.mastodonOauthState)
    .where(eq(schema.mastodonOauthState.id, oauthState.id))

  // Get cached app registration
  const [app] = await db.select()
    .from(schema.mastodonApps)
    .where(eq(schema.mastodonApps.instanceUrl, state.instanceUrl))

  if (!app) {
    throw createError({ statusCode: 400, statusMessage: 'App registration not found' })
  }

  const redirectUri = `${getBaseURL()}/api/targets/mastodon/callback`

  // Exchange code for token
  let accessToken: string
  try {
    accessToken = await exchangeMastodonToken(
      state.instanceUrl,
      app.clientId,
      app.clientSecret,
      code,
      redirectUri,
    )
  } catch (e: any) {
    // If 401, delete cached app so re-registration is attempted next time
    if (e.status === 401) {
      await db.delete(schema.mastodonApps)
        .where(eq(schema.mastodonApps.id, app.id))
    }
    throw createError({ statusCode: 502, statusMessage: `Token exchange failed: ${e.message}` })
  }

  // Fetch instance config for character limit
  const config = await fetchInstanceConfig(state.instanceUrl)

  // Create the target
  const now = new Date()
  const target = {
    id: crypto.randomUUID(),
    userId: user.id,
    type: 'mastodon',
    name: state.targetName,
    credentials: JSON.stringify({
      instanceUrl: state.instanceUrl,
      accessToken,
      maxCharacters: config.maxCharacters,
    }),
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(schema.targets).values(target)

  // Redirect to the new target's page
  return sendRedirect(event, `/targets/${target.id}`)
})
