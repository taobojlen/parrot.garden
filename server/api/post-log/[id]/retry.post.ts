import { and, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  // Get the post log entry and verify ownership via join
  const [log] = await db.select()
    .from(schema.postLogs)
    .innerJoin(schema.connections, eq(schema.postLogs.connectionId, schema.connections.id))
    .innerJoin(schema.targets, eq(schema.connections.targetId, schema.targets.id))
    .where(and(
      eq(schema.postLogs.id, id),
      eq(schema.connections.userId, user.id),
      eq(schema.postLogs.status, 'failed'),
    ))

  if (!log) throw createError({ statusCode: 404, statusMessage: 'Failed post not found' })

  const target = log.target
  const connection = log.connection
  const postLog = log.post_log

  // Re-render and post using all stored template variables
  const { maxCharacters, urlCost } = getPostOptions(target)

  const text = truncatePost(
    renderTemplate(connection.template, {
      title: postLog.itemTitle ?? '',
      link: postLog.itemLink ?? '',
      description: postLog.itemDescription ?? '',
      content: postLog.itemContent ?? '',
      author: postLog.itemAuthor ?? '',
      date: postLog.itemPubDate ?? '',
    }),
    maxCharacters,
    urlCost !== undefined ? { urlCost } : undefined,
  )

  try {
    const credentials = JSON.parse(target.credentials)
    if (target.type === 'bluesky') {
      await postToBluesky(credentials, text)
    } else if (target.type === 'mastodon') {
      await postToMastodon(credentials, text)
    }

    await db.update(schema.postLogs)
      .set({ status: 'posted', error: null, updatedAt: new Date() })
      .where(eq(schema.postLogs.id, id))

    return { ok: true, status: 'posted' }
  }
  catch (e: any) {
    await db.update(schema.postLogs)
      .set({ error: e.message, attempts: postLog.attempts + 1, updatedAt: new Date() })
      .where(eq(schema.postLogs.id, id))

    throw createError({ statusCode: 502, statusMessage: `Post failed: ${e.message}` })
  }
})
