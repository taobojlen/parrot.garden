export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  if (!body.name || !body.url) {
    throw createError({ statusCode: 400, statusMessage: 'Name and URL are required' })
  }

  try {
    await fetchAndParseFeed(body.url)
  }
  catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: `Invalid RSS feed: ${e.message}` })
  }

  const now = new Date()
  const source = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: body.name,
    url: body.url,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(schema.sources).values(source)
  return source
})
