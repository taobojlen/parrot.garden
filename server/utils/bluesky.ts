import { AtpAgent, RichText } from '@atproto/api'
import { parse as parseHtml } from 'node-html-parser'
import type { FeedImage } from './rss'

interface BlueskyCredentials {
  handle: string
  appPassword: string
}

export async function resolvePdsUrl(
  handle: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const cleanHandle = handle.replace(/^@/, '')

  const resolveResponse = await fetchFn(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${cleanHandle}`,
  )
  if (!resolveResponse.ok) {
    throw new Error(`Failed to resolve DID for handle "${cleanHandle}"`)
  }

  const { did } = await resolveResponse.json() as { did: string }

  let didDocUrl: string
  if (did.startsWith('did:web:')) {
    const domain = did.slice('did:web:'.length)
    didDocUrl = `https://${domain}/.well-known/did.json`
  }
  else {
    didDocUrl = `https://plc.directory/${did}`
  }

  const didDocResponse = await fetchFn(didDocUrl)
  if (!didDocResponse.ok) {
    throw new Error(`Failed to resolve DID document for "${did}"`)
  }

  const didDoc = await didDocResponse.json()
  const pdsService = didDoc.service?.find(
    (s: { id: string }) => s.id === '#atproto_pds',
  )

  if (!pdsService?.serviceEndpoint) {
    throw new Error(`No PDS service found in DID document for "${did}"`)
  }

  return pdsService.serviceEndpoint
}

const MAX_IMAGE_BYTES = 2_000_000

class ImageResizeError extends Error {}

async function resizeImage(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const { env } = await import('cloudflare:workers')
  if (!env.IMAGES) throw new Error('Cloudflare IMAGES binding is not configured')

  for (const size of [2048, 1536, 1024, 512]) {
    const result = await env.IMAGES.input(new Blob([buffer]).stream())
      .transform({ width: size, height: size, fit: 'scale-down' })
      .output({ format: 'image/webp', quality: 80, anim: false })
    const resized = await result.response().arrayBuffer()
    if (resized.byteLength <= MAX_IMAGE_BYTES) return resized
  }
  throw new Error('Image still exceeds the 2 MB limit after resizing')
}

async function downloadAndUploadImage(
  agent: AtpAgent,
  image: FeedImage,
): Promise<{ alt: string; image: any } | null> {
  try {
    const response = await fetch(image.url)
    if (!response.ok) return null

    let contentType = response.headers.get('content-type') ?? 'image/jpeg'
    let buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      try {
        buffer = await resizeImage(buffer)
        contentType = 'image/webp'
      }
      catch (error) {
        throw new ImageResizeError(`Cannot resize Bluesky image ${image.url}: ${error instanceof Error ? error.message : error}`, { cause: error })
      }
    }
    const uint8 = new Uint8Array(buffer)

    const uploadResponse = await agent.uploadBlob(uint8, { encoding: contentType })
    return {
      alt: image.alt,
      image: uploadResponse.data.blob,
    }
  }
  catch (error) {
    if (error instanceof ImageResizeError) throw error
    return null
  }
}

async function createExternalEmbed(agent: AtpAgent, url: string): Promise<any | undefined> {
  try {
    const protocol = new URL(url).protocol
    if (protocol !== 'http:' && protocol !== 'https:') return undefined

    const response = await fetch(url)
    if (!response.ok) {
      console.warn('Bluesky link card fetch failed', {
        url,
        status: response.status,
        statusText: response.statusText,
      })
      return undefined
    }

    const doc = parseHtml(await response.text())
    const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
      ?? doc.querySelector('title')?.text.trim()
      ?? ''
    const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')
      ?? doc.querySelector('meta[name="description"]')?.getAttribute('content')
      ?? ''
    const imageUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
    const external: Record<string, unknown> = { uri: url, title, description }

    if (imageUrl) {
      try {
        const uploaded = await downloadAndUploadImage(agent, {
          url: new URL(imageUrl, response.url || url).toString(),
          alt: '',
        })
        if (uploaded) external.thumb = uploaded.image
      }
      catch (error) {
        if (error instanceof ImageResizeError) throw error
        // A bad optional thumbnail should not prevent the link card.
      }
    }

    return {
      $type: 'app.bsky.embed.external',
      external,
    }
  }
  catch (error) {
    if (error instanceof ImageResizeError) throw error
    console.warn('Bluesky link card creation failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

export async function verifyBlueskyCredentials(
  credentials: BlueskyCredentials,
): Promise<void> {
  try {
    const service = await resolvePdsUrl(credentials.handle)
    const agent = new AtpAgent({ service })
    await agent.login({
      identifier: credentials.handle,
      password: credentials.appPassword,
    })
  }
  catch (error) {
    throw new Error(`Bluesky authentication failed: ${error instanceof Error ? error.message : error}`, { cause: error })
  }
}

export async function postToBluesky(
  credentials: BlueskyCredentials,
  text: string,
  images?: FeedImage[],
): Promise<{ uri: string; cid: string }> {
  const service = await resolvePdsUrl(credentials.handle)
  const agent = new AtpAgent({ service })
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
  if (!embed) {
    const postLink = Array.from(rt.segments()).find(segment => segment.isLink())?.link?.uri
    if (postLink) embed = await createExternalEmbed(agent, postLink)
  }

  const response = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed,
    createdAt: new Date().toISOString(),
  })

  return { uri: response.uri, cid: response.cid }
}
