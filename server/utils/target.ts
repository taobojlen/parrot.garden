export interface PostOptions {
  maxCharacters: number
  urlCost?: number
}

const MASTODON_URL_COST = 23

export function getPostOptions(target: { type: string; credentials: string }): PostOptions {
  const creds = JSON.parse(target.credentials)
  const maxCharacters: number = creds.maxCharacters

  if (target.type === 'mastodon') {
    return { maxCharacters, urlCost: MASTODON_URL_COST }
  }

  return { maxCharacters }
}
