import { AtpAgent, RichText } from '@atproto/api'
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
    throw new Error(`Bluesky authentication failed: ${error instanceof Error ? error.message : error}`)
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

  const response = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed,
    createdAt: new Date().toISOString(),
  })

  return { uri: response.uri, cid: response.cid }
}
