import { chunk, SOURCE_ITEM_BATCH_SIZE } from '../../utils/batch'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  if (!body.name || !body.url) {
    throw createError({ statusCode: 400, statusMessage: 'Name and URL are required' })
  }

  let items
  try {
    items = await fetchAndParseFeed(body.url)
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

  // Record existing feed items so connections created later won't post them
  for (const batch of chunk(items, SOURCE_ITEM_BATCH_SIZE)) {
    await db.insert(schema.sourceItems).values(batch.map(item => ({
      id: crypto.randomUUID(),
      sourceId: source.id,
      itemGuid: item.guid,
      createdAt: now,
    }))).onConflictDoNothing()
  }

  return source
})
