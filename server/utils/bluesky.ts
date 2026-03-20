import { AtpAgent, RichText } from '@atproto/api'
import type { FeedImage } from './rss'

interface BlueskyCredentials {
  handle: string
  appPassword: string
}

async function downloadAndUploadImage(
  agent: AtpAgent,
  image: FeedImage,
): Promise<{ alt: string; image: any } | null> {
  try {
    const response = await fetch(image.url)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await response.arrayBuffer()
    const uint8 = new Uint8Array(buffer)

    const uploadResponse = await agent.uploadBlob(uint8, { encoding: contentType })
    return {
      alt: image.alt,
      image: uploadResponse.data.blob,
    }
  }
  catch {
    return null
  }
}

export async function postToBluesky(
  credentials: BlueskyCredentials,
  text: string,
  images?: FeedImage[],
): Promise<{ uri: string; cid: string }> {
  const agent = new AtpAgent({ service: 'https://bsky.social' })
  await agent.login({
    identifier: credentials.handle,
    password: credentials.appPassword,
  })

  const rt = new RichText({ text })
  await rt.detectFacets(agent)

  let embed: any
  if (images && images.length > 0) {
    const uploaded = await Promise.all(
      images.map(img => downloadAndUploadImage(agent, img)),
    )
    const successful = uploaded.filter((u): u is NonNullable<typeof u> => u !== null)
    if (successful.length > 0) {
      embed = {
        $type: 'app.bsky.embed.images',
        images: successful,
      }
    }
  }

  const response = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed,
    createdAt: new Date().toISOString(),
  })

  return { uri: response.uri, cid: response.cid }
}
