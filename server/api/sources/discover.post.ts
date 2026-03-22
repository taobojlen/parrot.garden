export default eventHandler(async (event) => {
  await requireAuth(event)
  const body = await readBody(event)

  if (!body.url) {
    throw createError({ statusCode: 400, statusMessage: 'URL is required' })
  }

  try {
    return await discoverFeeds(body.url)
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e.message })
  }
})
