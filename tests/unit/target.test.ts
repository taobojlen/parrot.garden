import { describe, it, expect } from 'vitest'
import { getPostOptions } from '../../server/utils/target'

describe('getPostOptions', () => {
  it('returns maxCharacters and urlCost for mastodon target', () => {
    const target = {
      type: 'mastodon',
      credentials: JSON.stringify({ instanceUrl: 'mastodon.social', accessToken: 'tok', maxCharacters: 500 }),
    }
    const opts = getPostOptions(target)
    expect(opts).toEqual({ maxCharacters: 500, urlCost: 23 })
  })

  it('returns maxCharacters without urlCost for bluesky target', () => {
    const target = {
      type: 'bluesky',
      credentials: JSON.stringify({ handle: 'test.bsky.social', appPassword: 'pw', maxCharacters: 300 }),
    }
    const opts = getPostOptions(target)
    expect(opts).toEqual({ maxCharacters: 300 })
  })

  it('reads maxCharacters from credentials for mastodon with custom limit', () => {
    const target = {
      type: 'mastodon',
      credentials: JSON.stringify({ instanceUrl: 'fosstodon.org', accessToken: 'tok', maxCharacters: 1000 }),
    }
    const opts = getPostOptions(target)
    expect(opts).toEqual({ maxCharacters: 1000, urlCost: 23 })
  })
})
