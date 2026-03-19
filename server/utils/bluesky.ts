import { AtpAgent, RichText } from '@atproto/api'

interface BlueskyCredentials {
  handle: string
  appPassword: string
}

export async function postToBluesky(
  credentials: BlueskyCredentials,
  text: string,
): Promise<{ uri: string; cid: string }> {
  const agent = new AtpAgent({ service: 'https://bsky.social' })
  await agent.login({
    identifier: credentials.handle,
    password: credentials.appPassword,
  })

  const rt = new RichText({ text })
  await rt.detectFacets(agent)

  const response = await agent.post({
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  })

  return { uri: response.uri, cid: response.cid }
}
