# Mastodon Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mastodon as a target type with OAuth-based authorization and per-instance character limits.

**Architecture:** Extend the existing target system with a Mastodon posting function, OAuth flow for authorization (dynamic per-instance app registration), and per-target character limits with URL-cost-aware truncation. Two new DB tables cache Mastodon app registrations and OAuth state for CSRF protection.

**Tech Stack:** Nuxt 4, Drizzle ORM (SQLite/D1), Mastodon REST API, OAuth 2.0, Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-mastodon-target-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/utils/template.ts` | Modify | Add `urlCost` option to `truncatePost`, handle all URLs |
| `tests/unit/template.test.ts` | Modify | Tests for `urlCost` truncation behavior |
| `server/utils/target.ts` | Create | `getPostOptions(target)` helper returning `{ maxCharacters, urlCost? }` |
| `tests/unit/target.test.ts` | Create | Tests for `getPostOptions` |
| `server/db/schema.ts` | Modify | Add `mastodonApps` and `mastodonOauthState` tables |
| `server/utils/mastodon.ts` | Create | `postToMastodon()`, `registerMastodonApp()`, `exchangeMastodonToken()`, `fetchInstanceConfig()`, `normalizeInstanceUrl()` |
| `tests/unit/mastodon.test.ts` | Create | Tests for `postToMastodon` and helpers |
| `server/api/targets/mastodon/authorize.post.ts` | Create | OAuth initiation endpoint |
| `server/api/targets/mastodon/callback.get.ts` | Create | OAuth callback endpoint |
| `server/api/targets/index.post.ts` | Modify | Inject `maxCharacters: 300` into Bluesky credentials |
| `server/api/targets/[id].put.ts` | Modify | Inject `maxCharacters: 300` on Bluesky credential updates, add `mastodon: []` to `CREDENTIAL_SHAPES` |
| `server/api/targets/[id].get.ts` | Modify | Return `instanceUrl` for Mastodon targets |
| `server/utils/auth.ts` | Modify | Export `getBaseURL` so OAuth endpoints can use it |
| `server/utils/poll.ts` | Modify | Accept `maxCharacters` + `urlCost` instead of hardcoding 300 |
| `tests/unit/poll.test.ts` | Modify | Update tests for new `maxCharacters` param |
| `server/tasks/feed/poll.ts` | Modify | Add mastodon dispatch, use `getPostOptions` |
| `server/api/connections/[id]/test.post.ts` | Modify | Add mastodon branch, use `getPostOptions` |
| `server/api/connections/[id]/post-item.post.ts` | Modify | Same |
| `server/api/post-log/[id]/retry.post.ts` | Modify | Same |
| `app/pages/targets/new.vue` | Modify | Add Mastodon type + OAuth flow |
| `app/pages/targets/[id].vue` | Modify | Add Mastodon display + re-authorize |
| `server/db/migrations/add-bluesky-max-chars.ts` | Create | Data migration for existing Bluesky targets |

---

### Task 1: Extend `truncatePost` with `urlCost` option

**Files:**
- Modify: `server/utils/template.ts`
- Modify: `tests/unit/template.test.ts`

- [ ] **Step 1: Write failing tests for `urlCost` behavior**

Add these tests to the existing `truncatePost` describe block in `tests/unit/template.test.ts`:

```ts
it('counts URLs at urlCost when option is provided', () => {
  // URL is 35 graphemes, but with urlCost=23 it counts as 23
  const url = 'https://example.com/very-long-path'
  const text = `Check this out ${url}`
  // Without urlCost: graphemeLength('Check this out ') + graphemeLength(url) = 15 + 35 = 50
  // With urlCost=23: 15 + 23 = 38
  const result = truncatePost(text, 40, { urlCost: 23 })
  expect(result).toBe(text) // fits within 40 because URL counts as 23
})

it('truncates non-URL content when urlCost makes text exceed limit', () => {
  const prefix = 'A'.repeat(280)
  const url = 'https://example.com/path'
  const text = `${prefix} ${url}`
  const result = truncatePost(text, 300, { urlCost: 23 })
  // Budget for non-URL text: 300 - 23 = 277, minus 1 for "…" = 276
  expect(result.endsWith(url)).toBe(true)
  expect(result.includes('…')).toBe(true)
})

it('handles multiple URLs with urlCost', () => {
  const url1 = 'https://example.com/first-very-long-url-path'
  const url2 = 'https://example.com/second-very-long-url-path'
  const text = `See ${url1} and ${url2}`
  // With urlCost=23: "See " (4) + 23 + " and " (5) + 23 = 55
  const result = truncatePost(text, 60, { urlCost: 23 })
  expect(result).toBe(text) // fits because URLs count as 23 each
})

it('without urlCost, counts URLs at real length (existing behavior)', () => {
  const url = 'https://example.com/very-long-path'
  const text = `Check this out ${url}`
  // Real length: 15 + 35 = 50, limit is 40
  const result = truncatePost(text, 40)
  expect(result.length).toBeLessThanOrEqual(40)
  expect(result.includes('…')).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/template.test.ts`
Expected: New tests fail (truncatePost doesn't accept options param yet)

- [ ] **Step 3: Implement `urlCost` in `truncatePost`**

Update `server/utils/template.ts`. Change the `URL_REGEX` to match all URLs (not just trailing), add the options parameter, and update the truncation logic:

```ts
const URL_REGEX_GLOBAL = /https?:\/\/[^\s]+/g
const URL_REGEX_TRAILING = /https?:\/\/[^\s]+$/
const segmenter = new Intl.Segmenter()

export function renderTemplate(
  template: string,
  variables: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '')
}

function graphemeLength(text: string): number {
  return [...segmenter.segment(text)].length
}

function sliceGraphemes(text: string, count: number): string {
  return [...segmenter.segment(text)].slice(0, count).map(s => s.segment).join('')
}

interface TruncateOptions {
  urlCost?: number
}

export function truncatePost(text: string, maxGraphemes: number, options?: TruncateOptions): string {
  const { urlCost } = options ?? {}

  if (urlCost !== undefined) {
    return truncateWithUrlCost(text, maxGraphemes, urlCost)
  }

  // Original behavior: no urlCost
  if (graphemeLength(text) <= maxGraphemes) return text

  const match = text.match(URL_REGEX_TRAILING)
  if (match) {
    const url = match[0]
    const prefix = text.slice(0, text.length - url.length).trimEnd()
    const urlGraphemes = graphemeLength(url)
    const prefixBudget = maxGraphemes - urlGraphemes - 2
    if (prefixBudget > 0) {
      return sliceGraphemes(prefix, prefixBudget) + '… ' + url
    }
  }

  return sliceGraphemes(text, maxGraphemes - 1) + '…'
}

function truncateWithUrlCost(text: string, maxGraphemes: number, urlCost: number): string {
  // Find all URLs and calculate their cost vs real length
  const urls: { start: number; end: number; value: string }[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(URL_REGEX_GLOBAL)
  while ((match = regex.exec(text)) !== null) {
    urls.push({ start: match.index, end: match.index + match[0].length, value: match[0] })
  }

  if (urls.length === 0) {
    // No URLs: simple grapheme truncation
    if (graphemeLength(text) <= maxGraphemes) return text
    return sliceGraphemes(text, maxGraphemes - 1) + '…'
  }

  // Calculate effective length: non-URL graphemes + (urlCost * urlCount)
  const nonUrlParts: string[] = []
  let pos = 0
  for (const url of urls) {
    nonUrlParts.push(text.slice(pos, url.start))
    pos = url.end
  }
  nonUrlParts.push(text.slice(pos))

  const nonUrlGraphemes = nonUrlParts.reduce((sum, part) => sum + graphemeLength(part), 0)
  const effectiveLength = nonUrlGraphemes + urls.length * urlCost

  if (effectiveLength <= maxGraphemes) return text

  // Need to truncate. Budget for non-URL content:
  const nonUrlBudget = maxGraphemes - urls.length * urlCost

  if (nonUrlBudget <= 1) {
    // Not enough room even for ellipsis + URLs
    return sliceGraphemes(text, maxGraphemes - 1) + '…'
  }

  // Rebuild text, truncating non-URL content but always preserving URLs
  let remaining = nonUrlBudget - 1 // reserve 1 for ellipsis
  let result = ''
  let truncated = false

  for (let i = 0; i < nonUrlParts.length; i++) {
    const part = nonUrlParts[i]
    const partLen = graphemeLength(part)

    if (!truncated && remaining >= partLen) {
      result += part
      remaining -= partLen
    } else if (!truncated) {
      result += sliceGraphemes(part, remaining).trimEnd() + '…'
      truncated = true
    }
    // Always append URLs — Mastodon counts them at fixed cost so they must be preserved
    if (i < urls.length) {
      if (truncated && !result.endsWith(' ')) {
        result += ' '
      }
      result += urls[i].value
    }
  }

  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/template.test.ts`
Expected: All tests pass (existing + new)

- [ ] **Step 5: Commit**

```bash
git add server/utils/template.ts tests/unit/template.test.ts
git commit -m "feat: add urlCost option to truncatePost for Mastodon-style URL counting"
```

---

### Task 2: Add `getPostOptions` helper

**Files:**
- Create: `server/utils/target.ts`
- Create: `tests/unit/target.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/target.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/target.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `getPostOptions`**

Create `server/utils/target.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/target.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/utils/target.ts tests/unit/target.test.ts
git commit -m "feat: add getPostOptions helper for per-target character limits"
```

---

### Task 3: Add DB schema for Mastodon tables

**Files:**
- Modify: `server/db/schema.ts`

- [ ] **Step 1: Add `mastodonApps` and `mastodonOauthState` tables**

Append to `server/db/schema.ts` after the `postLogs` table:

```ts
export const mastodonApps = sqliteTable('mastodon_app', {
  id: text('id').primaryKey(),
  instanceUrl: text('instance_url').notNull().unique(),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const mastodonOauthState = sqliteTable('mastodon_oauth_state', {
  id: text('id').primaryKey(),
  nonce: text('nonce').notNull().unique(),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
```

- [ ] **Step 2: Generate and apply migration**

Run: `npx drizzle-kit generate` then `npx drizzle-kit migrate` (or whatever the project's migration workflow is — check if NuxtHub handles this automatically via `hub.db`).

- [ ] **Step 3: Commit**

```bash
git add server/db/schema.ts
git commit -m "feat: add mastodon_app and mastodon_oauth_state tables"
```

---

### Task 4: Implement Mastodon posting utility

**Files:**
- Create: `server/utils/mastodon.ts`
- Create: `tests/unit/mastodon.test.ts`

- [ ] **Step 1: Write failing tests for `postToMastodon`**

Create `tests/unit/mastodon.test.ts`. Follow the pattern from `tests/unit/bluesky.test.ts` — mock `fetch` globally:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postToMastodon, normalizeInstanceUrl } from '../../server/utils/mastodon'
import type { FeedImage } from '../../server/utils/rss'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const credentials = {
  instanceUrl: 'mastodon.social',
  accessToken: 'test-token',
  maxCharacters: 500,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeInstanceUrl', () => {
  it('strips https:// prefix', () => {
    expect(normalizeInstanceUrl('https://mastodon.social')).toBe('mastodon.social')
  })

  it('strips http:// prefix', () => {
    expect(normalizeInstanceUrl('http://mastodon.social')).toBe('mastodon.social')
  })

  it('strips trailing slash', () => {
    expect(normalizeInstanceUrl('mastodon.social/')).toBe('mastodon.social')
  })

  it('lowercases', () => {
    expect(normalizeInstanceUrl('Mastodon.Social')).toBe('mastodon.social')
  })

  it('handles combination', () => {
    expect(normalizeInstanceUrl('HTTPS://Mastodon.Social/')).toBe('mastodon.social')
  })
})

describe('postToMastodon', () => {
  it('posts a status with text only', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: '12345', url: 'https://mastodon.social/@user/12345' }),
    })

    await postToMastodon(credentials, 'Hello from Parrot')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mastodon.social/api/v1/statuses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
        }),
      }),
    )
  })

  it('uploads images and attaches media_ids', async () => {
    // First call: media upload
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'media-1' }),
      })
      // Second call: status post
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '12345' }),
      })

    const images: FeedImage[] = [
      { url: 'https://example.com/photo.jpg', alt: 'A photo' },
    ]
    await postToMastodon(credentials, 'With image', images)

    // Should have 3 fetch calls: download image, upload media, post status
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('skips images that fail to download', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '12345' }),
      })

    const images: FeedImage[] = [
      { url: 'https://example.com/broken.jpg', alt: 'Broken' },
    ]
    await postToMastodon(credentials, 'Broken image', images)

    // download failed, so just post status without media
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws on non-ok status response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Unauthorized'),
    })

    await expect(postToMastodon(credentials, 'Will fail'))
      .rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/mastodon.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `server/utils/mastodon.ts`**

```ts
import type { FeedImage } from './rss'

interface MastodonCredentials {
  instanceUrl: string
  accessToken: string
  maxCharacters: number
}

export function normalizeInstanceUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .toLowerCase()
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/mastodon.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/utils/mastodon.ts tests/unit/mastodon.test.ts
git commit -m "feat: add Mastodon posting utility with image upload"
```

---

### Task 5: Update `processConnectionItems` to accept character limit options

**Files:**
- Modify: `server/utils/poll.ts`
- Modify: `tests/unit/poll.test.ts`

- [ ] **Step 1: Update tests to pass `maxCharacters` and `urlCost`**

In `tests/unit/poll.test.ts`, update `baseArgs` to include `maxCharacters`:

```ts
const baseArgs = {
  connectionId: 'conn-1',
  template: '{{title}} {{link}}',
  includeImages: false,
  target: { type: 'bluesky' as const, credentials: '{}' },
  maxCharacters: 300,
}
```

- [ ] **Step 2: Run tests to verify they still pass** (the new field is just ignored until we use it)

Run: `npx vitest run tests/unit/poll.test.ts`
Expected: PASS (extra property is harmless)

- [ ] **Step 3: Update `processConnectionItems` to use `maxCharacters` and `urlCost`**

In `server/utils/poll.ts`, update the function signature and the `truncatePost` call:

Change the opts type to include `maxCharacters: number` and `urlCost?: number`.

Replace the `truncatePost` call (currently hardcoded to 300):

```ts
const text = truncatePost(
  renderTemplate(template, { ... }),
  opts.maxCharacters,
  opts.urlCost !== undefined ? { urlCost: opts.urlCost } : undefined,
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/poll.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/utils/poll.ts tests/unit/poll.test.ts
git commit -m "feat: make processConnectionItems accept per-target character limits"
```

---

### Task 6: Inject `maxCharacters` into Bluesky target credentials

**Files:**
- Modify: `server/api/targets/index.post.ts`
- Modify: `server/api/targets/[id].put.ts`

- [ ] **Step 1: Update `POST /api/targets` to inject `maxCharacters: 300` for Bluesky**

In `server/api/targets/index.post.ts`, after the credential sanitization loop, add:

```ts
if (body.type === 'bluesky') {
  credentials.maxCharacters = '300'
}
```

Wait — `maxCharacters` should be a number in JSON. Since `credentials` is a `Record<string, string>` that gets `JSON.stringify`'d, store it as part of the JSON. Actually, looking at the code, `credentials` is built as `Record<string, string>` then stringified. Change the approach: after building `credentials`, convert to the final object before stringifying:

```ts
const finalCredentials: Record<string, unknown> = { ...credentials }
if (body.type === 'bluesky') {
  finalCredentials.maxCharacters = 300
}

// Then use JSON.stringify(finalCredentials) instead of JSON.stringify(credentials)
```

- [ ] **Step 2: Update `PUT /api/targets/[id]` similarly**

In `server/api/targets/[id].put.ts`, after building `credentials`, inject `maxCharacters: 300` for Bluesky before stringifying.

- [ ] **Step 3: Verify the app builds**

Run: `npx nuxi typecheck` or `npx nuxt build`

- [ ] **Step 4: Commit**

```bash
git add server/api/targets/index.post.ts server/api/targets/[id].put.ts
git commit -m "feat: inject maxCharacters into Bluesky credentials on create/update"
```

---

### Task 7: Data migration for existing Bluesky targets

**Files:**
- Create: `server/db/migrations/add-bluesky-max-chars.ts`

- [ ] **Step 1: Create migration script**

Create `server/db/migrations/add-bluesky-max-chars.ts`:

```ts
import { eq } from 'drizzle-orm'

export async function migrateBlueskyMaxChars(db: any, schema: any) {
  const targets = await db.select({
    id: schema.targets.id,
    credentials: schema.targets.credentials,
  })
    .from(schema.targets)
    .where(eq(schema.targets.type, 'bluesky'))

  for (const target of targets) {
    const creds = JSON.parse(target.credentials)
    if (creds.maxCharacters !== undefined) continue
    creds.maxCharacters = 300
    await db.update(schema.targets)
      .set({ credentials: JSON.stringify(creds), updatedAt: new Date() })
      .where(eq(schema.targets.id, target.id))
  }
}
```

Note: The actual invocation mechanism depends on the project's migration approach. This could be a standalone script, a Nitro task, or run manually. Check how the project handles custom migrations (NuxtHub may auto-apply Drizzle migrations but this is a data migration, not a schema migration).

- [ ] **Step 2: Commit**

```bash
git add server/db/migrations/add-bluesky-max-chars.ts
git commit -m "feat: data migration to add maxCharacters to existing Bluesky targets"
```

---

### Task 8: Wire up Mastodon dispatch in all posting endpoints

**Files:**
- Modify: `server/tasks/feed/poll.ts`
- Modify: `server/api/connections/[id]/test.post.ts`
- Modify: `server/api/connections/[id]/post-item.post.ts`
- Modify: `server/api/post-log/[id]/retry.post.ts`

All four files follow the same pattern: they have `if (target.type === 'bluesky')` blocks that need a `mastodon` branch, and they hardcode `300` for truncation.

- [ ] **Step 1: Update `server/tasks/feed/poll.ts`**

Import `getPostOptions` from `../utils/target` (Nitro auto-imports from `server/utils`, so this should be available as `getPostOptions`).

Replace the `postFn` callback and truncation in the `processConnectionItems` call:

```ts
const { maxCharacters, urlCost } = getPostOptions(target)

const result = await processConnectionItems({
  items: newItems,
  existingLogs: existingGuids,
  connectionId,
  template: conn.connection.template,
  includeImages: conn.connection.includeImages,
  target: { type: target.type, credentials: target.credentials },
  maxCharacters,
  urlCost,
  postFn: async (credentials, text, images) => {
    if (target.type === 'bluesky') {
      await postToBluesky(credentials, text, images)
    } else if (target.type === 'mastodon') {
      await postToMastodon(credentials, text, images)
    }
  },
})
```

- [ ] **Step 2: Update `server/api/connections/[id]/test.post.ts`**

Replace the hardcoded `truncatePost(... 300)` and the `if (conn.target.type === 'bluesky')` block:

```ts
const { maxCharacters, urlCost } = getPostOptions(conn.target)

const text = truncatePost(
  renderTemplate(conn.connection.template, { ... }),
  maxCharacters,
  urlCost !== undefined ? { urlCost } : undefined,
)

const credentials = JSON.parse(conn.target.credentials)
if (conn.target.type === 'bluesky') {
  await postToBluesky(credentials, text, conn.connection.includeImages ? item.images : undefined)
} else if (conn.target.type === 'mastodon') {
  await postToMastodon(credentials, text, conn.connection.includeImages ? item.images : undefined)
}
```

- [ ] **Step 3: Update `server/api/connections/[id]/post-item.post.ts`**

Same pattern as test.post.ts.

- [ ] **Step 4: Update `server/api/post-log/[id]/retry.post.ts`**

Same pattern. Note: retry doesn't have images (they aren't stored in post_log), so just `postToMastodon(credentials, text)`.

- [ ] **Step 5: Verify the app builds**

Run: `npx nuxi typecheck`

- [ ] **Step 6: Commit**

```bash
git add server/tasks/feed/poll.ts server/api/connections/\[id\]/test.post.ts server/api/connections/\[id\]/post-item.post.ts server/api/post-log/\[id\]/retry.post.ts
git commit -m "feat: wire up Mastodon dispatch in all posting endpoints"
```

---

### Task 9: Mastodon OAuth endpoints

**Files:**
- Modify: `server/utils/auth.ts`
- Create: `server/api/targets/mastodon/authorize.post.ts`
- Create: `server/api/targets/mastodon/callback.get.ts`

- [ ] **Step 0: Export `getBaseURL` from `server/utils/auth.ts`**

The OAuth endpoints need `getBaseURL()` to build the callback URL. It's currently a private function. Export it so Nitro auto-imports it:

In `server/utils/auth.ts`, change line 41 from:
```ts
function getBaseURL(): string {
```
to:
```ts
export function getBaseURL(): string {
```

- [ ] **Step 1: Create the authorize endpoint**

Create `server/api/targets/mastodon/authorize.post.ts`:

```ts
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody<{ instanceUrl: string; targetName: string }>(event)

  if (!body.instanceUrl || !body.targetName) {
    throw createError({ statusCode: 400, statusMessage: 'instanceUrl and targetName are required' })
  }

  const instanceUrl = normalizeInstanceUrl(body.instanceUrl)

  // Verify instance is reachable
  const instanceCheck = await fetch(`https://${instanceUrl}/api/v1/instance`)
  if (!instanceCheck.ok) {
    throw createError({ statusCode: 400, statusMessage: `Cannot reach Mastodon instance: ${instanceUrl}` })
  }

  // Get or create app registration
  const redirectUri = `${getBaseURL()}/api/targets/mastodon/callback`

  let app = await db.select()
    .from(schema.mastodonApps)
    .where(eq(schema.mastodonApps.instanceUrl, instanceUrl))
    .then(rows => rows[0])

  if (!app) {
    const registered = await registerMastodonApp(instanceUrl, redirectUri)
    app = {
      id: crypto.randomUUID(),
      instanceUrl,
      clientId: registered.clientId,
      clientSecret: registered.clientSecret,
      createdAt: new Date(),
    }
    await db.insert(schema.mastodonApps).values(app)
  }

  // Create OAuth state for CSRF protection
  const nonce = crypto.randomUUID()
  await db.insert(schema.mastodonOauthState).values({
    id: crypto.randomUUID(),
    nonce,
    userId: user.id,
    createdAt: new Date(),
  })

  const state = btoa(JSON.stringify({ nonce, targetName: body.targetName, instanceUrl }))

  const authUrl = `https://${instanceUrl}/oauth/authorize?` + new URLSearchParams({
    client_id: app.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'write:statuses write:media',
    state,
  }).toString()

  return { url: authUrl }
})
```

Note: `getBaseURL()` is defined in `server/utils/auth.ts` and should be auto-imported by Nitro. If not, extract it to a shared util or import it.

- [ ] **Step 2: Create the callback endpoint**

Create `server/api/targets/mastodon/callback.get.ts`:

```ts
import { and, eq, lt } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  const code = query.code as string
  const stateParam = query.state as string

  if (!code || !stateParam) {
    throw createError({ statusCode: 400, statusMessage: 'Missing code or state parameter' })
  }

  // Parse and verify state
  let state: { nonce: string; targetName: string; instanceUrl: string }
  try {
    state = JSON.parse(atob(stateParam))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid state parameter' })
  }

  // Clean up expired states (older than 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  await db.delete(schema.mastodonOauthState)
    .where(lt(schema.mastodonOauthState.createdAt, tenMinutesAgo))

  // Verify nonce
  const [oauthState] = await db.select()
    .from(schema.mastodonOauthState)
    .where(and(
      eq(schema.mastodonOauthState.nonce, state.nonce),
      eq(schema.mastodonOauthState.userId, user.id),
    ))

  if (!oauthState) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired OAuth state' })
  }

  // Delete used nonce
  await db.delete(schema.mastodonOauthState)
    .where(eq(schema.mastodonOauthState.id, oauthState.id))

  // Get cached app registration
  const app = await db.select()
    .from(schema.mastodonApps)
    .where(eq(schema.mastodonApps.instanceUrl, state.instanceUrl))
    .then(rows => rows[0])

  if (!app) {
    throw createError({ statusCode: 400, statusMessage: 'App registration not found' })
  }

  const redirectUri = `${getBaseURL()}/api/targets/mastodon/callback`

  // Exchange code for token
  let accessToken: string
  try {
    accessToken = await exchangeMastodonToken(
      state.instanceUrl,
      app.clientId,
      app.clientSecret,
      code,
      redirectUri,
    )
  } catch (e: any) {
    // If 401, delete cached app so re-registration is attempted next time
    if (e.status === 401) {
      await db.delete(schema.mastodonApps)
        .where(eq(schema.mastodonApps.id, app.id))
    }
    throw createError({ statusCode: 502, statusMessage: `Token exchange failed: ${e.message}` })
  }

  // Fetch instance config for character limit
  const config = await fetchInstanceConfig(state.instanceUrl)

  // Create the target
  const now = new Date()
  const target = {
    id: crypto.randomUUID(),
    userId: user.id,
    type: 'mastodon',
    name: state.targetName,
    credentials: JSON.stringify({
      instanceUrl: state.instanceUrl,
      accessToken,
      maxCharacters: config.maxCharacters,
    }),
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(schema.targets).values(target)

  // Redirect to the new target's page
  return sendRedirect(event, `/targets/${target.id}`)
})
```

- [ ] **Step 3: Verify `getBaseURL` is accessible**

Check that `getBaseURL()` from `server/utils/auth.ts` is auto-imported by Nitro. If not, either export it separately or extract the URL logic into a shared util. Nitro auto-imports all exports from `server/utils/`, so it should work.

- [ ] **Step 4: Verify the app builds**

Run: `npx nuxi typecheck`

- [ ] **Step 5: Commit**

```bash
git add server/api/targets/mastodon/authorize.post.ts server/api/targets/mastodon/callback.get.ts
git commit -m "feat: add Mastodon OAuth authorize and callback endpoints"
```

---

### Task 10: Update target UI for Mastodon

**Files:**
- Modify: `app/pages/targets/new.vue`
- Modify: `app/pages/targets/[id].vue`

- [ ] **Step 1: Update `app/pages/targets/new.vue`**

Add Mastodon to the type dropdown. Show instance URL field + "Authorize with Mastodon" button when Mastodon is selected. The submit flow for Mastodon calls the authorize endpoint and redirects.

```vue
<template>
  <div class="mx-auto max-w-lg">
    <div class="flex items-center gap-2 mb-6">
      <UButton to="/dashboard" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm" />
      <h1 class="text-2xl font-bold ">Add Target</h1>
    </div>
    <UCard>
      <UForm :state="formState" @submit="handleSubmit">
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput v-model="form.name" placeholder="My Bluesky" icon="i-lucide-type" required class="w-full" />
          </UFormField>
          <UFormField label="Type" name="type" required>
            <USelect v-model="form.type" :items="targetTypes" value-key="value" required class="w-full" />
          </UFormField>
          <template v-if="form.type === 'bluesky'">
            <USeparator />
            <UFormField label="Handle" name="handle" required>
              <UInput v-model="credentials.handle" placeholder="you.bsky.social" icon="i-lucide-at-sign" required class="w-full" />
            </UFormField>
            <UFormField label="App Password" name="appPassword" hint="Generate at Settings > App Passwords on Bluesky" required>
              <UInput v-model="credentials.appPassword" type="password" placeholder="xxxx-xxxx-xxxx-xxxx" icon="i-lucide-key-round" required class="w-full" />
            </UFormField>
          </template>
          <template v-if="form.type === 'mastodon'">
            <USeparator />
            <UFormField label="Instance URL" name="instanceUrl" required>
              <UInput v-model="mastodonInstance" placeholder="mastodon.social" icon="i-lucide-globe" required class="w-full" />
            </UFormField>
          </template>
        </div>
        <div class="flex items-center gap-2 mt-6">
          <UButton v-if="form.type === 'mastodon'" type="submit" :loading="loading" icon="i-lucide-external-link">
            Authorize with Mastodon
          </UButton>
          <UButton v-else type="submit" :loading="loading">Add Target</UButton>
          <UButton to="/dashboard" variant="ghost" color="neutral">Cancel</UButton>
        </div>
      </UForm>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
        class="mt-4"
      />
    </UCard>
  </div>
</template>

<script setup lang="ts">
const targetTypes = [
  { label: 'Bluesky', value: 'bluesky' },
  { label: 'Mastodon', value: 'mastodon' },
]
const form = reactive({ name: '', type: 'bluesky' })
const credentials = reactive({ handle: '', appPassword: '' })
const mastodonInstance = ref('')
const loading = ref(false)
const error = ref('')

const formState = computed(() => ({ ...form, ...credentials, instanceUrl: mastodonInstance.value }))

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    if (form.type === 'mastodon') {
      const { url } = await $fetch('/api/targets/mastodon/authorize', {
        method: 'POST',
        body: { instanceUrl: mastodonInstance.value, targetName: form.name },
      })
      window.location.href = url
    } else {
      const created = await $fetch('/api/targets', { method: 'POST', body: { ...form, credentials } })
      navigateTo(`/targets/${created.id}`)
    }
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Failed to add target'
  } finally {
    loading.value = false
  }
}
</script>
```

- [ ] **Step 2: Update `app/pages/targets/[id].vue`**

Add Mastodon display: show the instance URL (read-only, from the API — requires the GET endpoint to return it). For mastodon targets, show a "Re-authorize" button instead of editable credential fields. The re-authorize button triggers the same OAuth flow but the callback should update the existing target instead of creating a new one.

For the edit page, the key changes are:
- Add `mastodon` to `targetTypes`
- When `form.type === 'mastodon'`, show instance URL as read-only text and a "Re-authorize" button
- The re-authorize flow: call authorize endpoint, redirect to Mastodon, callback updates the existing target

Note: Re-authorization is a stretch goal. For the initial implementation, just show the instance URL and a note that credentials are managed via OAuth. The user can delete and re-create the target to re-authorize.

```vue
<!-- Add to the template, after the bluesky credential fields -->
<template v-if="form.type === 'mastodon'">
  <USeparator />
  <UFormField label="Instance">
    <p class="text-sm text-neutral-500">{{ mastodonInstance }}</p>
  </UFormField>
  <p class="text-xs text-neutral-400">Credentials are managed via OAuth. Delete and re-create the target to re-authorize.</p>
</template>
```

In the script, add:
```ts
const targetTypes = [
  { label: 'Bluesky', value: 'bluesky' },
  { label: 'Mastodon', value: 'mastodon' },
]

// Parse instance URL from target data (API needs to return it for display)
const mastodonInstance = computed(() => {
  if (target.value?.type === 'mastodon' && target.value?.instanceUrl) {
    return target.value.instanceUrl
  }
  return ''
})
```

Also update the `handleSubmit` to skip credential submission for mastodon targets:
```ts
if (form.type === 'mastodon') {
  body = { name: form.name }
}
```

- [ ] **Step 3: Update GET `/api/targets/[id]` to return instance URL for mastodon targets**

In `server/api/targets/[id].get.ts`, the current query only selects specific columns and does NOT select `credentials`. Add `credentials` to the select, then strip it from the response after extracting `instanceUrl`:

```ts
const [target] = await db.select({
  id: schema.targets.id,
  userId: schema.targets.userId,
  type: schema.targets.type,
  name: schema.targets.name,
  credentials: schema.targets.credentials,
  createdAt: schema.targets.createdAt,
  updatedAt: schema.targets.updatedAt,
}).from(schema.targets)
  .where(and(eq(schema.targets.id, id), eq(schema.targets.userId, user.id)))

if (!target) throw createError({ statusCode: 404, statusMessage: 'Target not found' })

const { credentials, ...rest } = target
const result: Record<string, unknown> = { ...rest }
if (target.type === 'mastodon') {
  result.instanceUrl = JSON.parse(credentials).instanceUrl
}
return result
```

Also add `mastodon: []` to `CREDENTIAL_SHAPES` in both `server/api/targets/index.post.ts` and `server/api/targets/[id].put.ts` so the endpoints don't reject mastodon targets:

```ts
const CREDENTIAL_SHAPES: Record<string, string[]> = {
  bluesky: ['handle', 'appPassword'],
  mastodon: [],
}
```

- [ ] **Step 4: Manually test the full flow in dev**

1. Start dev server: `npx nuxt dev`
2. Navigate to /targets/new
3. Select Mastodon, enter name and instance URL
4. Click "Authorize with Mastodon"
5. Verify redirect to Mastodon instance
6. Authorize and verify callback creates target
7. Verify target edit page shows instance URL

- [ ] **Step 5: Commit**

```bash
git add app/pages/targets/new.vue app/pages/targets/\[id\].vue server/api/targets/\[id\].get.ts
git commit -m "feat: add Mastodon target UI with OAuth authorization flow"
```

---

### Task 11: Final integration verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Type check**

Run: `npx nuxi typecheck`
Expected: No errors

- [ ] **Step 3: Test end-to-end flow manually**

1. Create a Mastodon target via OAuth
2. Create a connection from an RSS source to the Mastodon target
3. Use the "Test" button on the connection page to verify posting works
4. Verify the post appears on the Mastodon instance

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for Mastodon target support"
```
