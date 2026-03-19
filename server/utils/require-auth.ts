import type { H3Event } from 'h3'

export async function requireAuth(event: H3Event) {
  const session = await serverAuth().api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session.user
}
