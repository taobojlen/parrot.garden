import type { FeedImage } from './rss'

interface MastodonCredentials {
  instanceUrl: string
  accessToken: string
  maxCharacters: number
}

export function normalizeInstanceUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
}

async function uploadMedia(
  instanceUrl: string,
  accessToken: string,
  image: FeedImage,
): Promise<string | null> {
  try {
    const response = await fetch(image.url)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await response.arrayBuffer()

    const formData = new FormData()
    formData.append('file', new Blob([buffer], { type: contentType }), 'image')
    if (image.alt) {
      formData.append('description', image.alt)
    }

    const uploadResponse = await fetch(`https://${instanceUrl}/api/v1/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: formData,
    })

    if (!uploadResponse.ok) return null

    const media = await uploadResponse.json() as { id: string }
    return media.id
  }
  catch {
    return null
  }
}

export async function postToMastodon(
  credentials: MastodonCredentials,
  text: string,
  images?: FeedImage[],
): Promise<{ id: string }> {
  const { instanceUrl, accessToken } = credentials

  const mediaIds: string[] = []
  if (images && images.length > 0) {
    const results = await Promise.all(
      images.map(img => uploadMedia(instanceUrl, accessToken, img)),
    )
    for (const id of results) {
      if (id) mediaIds.push(id)
    }
  }

  const body: Record<string, unknown> = { status: text }
  if (mediaIds.length > 0) {
    body.media_ids = mediaIds
  }

  const response = await fetch(`https://${instanceUrl}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    const error = new Error(`Mastodon API error: ${response.status} ${errorText}`)
    ;(error as any).status = response.status
    throw error
  }

  return await response.json() as { id: string }
}

export async function registerMastodonApp(
  instanceUrl: string,
  redirectUri: string,
): Promise<{ clientId: string; clientSecret: string }> {
  const response = await fetch(`https://${instanceUrl}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Parrot',
      redirect_uris: redirectUri,
      scopes: 'write:statuses write:media',
      website: 'https://parrot.garden',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to register app with ${instanceUrl}: ${response.status}`)
  }

  const app = await response.json() as { client_id: string; client_secret: string }
  return { clientId: app.client_id, clientSecret: app.client_secret }
}

export async function exchangeMastodonToken(
  instanceUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<string> {
  const response = await fetch(`https://${instanceUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = new Error(`Token exchange failed: ${response.status}`)
    ;(error as any).status = response.status
    throw error
  }

  const token = await response.json() as { access_token: string }
  return token.access_token
}

export async function fetchInstanceConfig(
  instanceUrl: string,
): Promise<{ maxCharacters: number }> {
  const response = await fetch(`https://${instanceUrl}/api/v2/instance`)

  if (!response.ok) {
    throw new Error(`Failed to fetch instance config from ${instanceUrl}: ${response.status}`)
  }

  const instance = await response.json() as {
    configuration?: { statuses?: { max_characters?: number } }
  }

  const maxCharacters = instance.configuration?.statuses?.max_characters
  if (typeof maxCharacters !== 'number') {
    throw new Error(`Instance ${instanceUrl} did not report max_characters`)
  }

  return { maxCharacters }
}
