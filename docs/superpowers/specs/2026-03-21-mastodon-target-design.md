# Mastodon Target Support

Add Mastodon as a target type, allowing users to cross-post RSS feed items to any Mastodon instance via OAuth.

## OAuth Flow

Mastodon is federated — each instance requires its own OAuth app registration.

1. User selects "Mastodon" target type, enters target name + instance URL (e.g. `mastodon.social`)
2. Instance URL is normalized: lowercased, protocol stripped, trailing slash stripped. Backend verifies the instance is reachable by hitting `GET https://{instance}/api/v1/instance`.
3. Backend calls `POST https://{instance}/api/v1/apps` to register (or reuses cached registration from `mastodon_app` table). The `redirect_uris` is set to `{appBaseUrl}/api/targets/mastodon/callback` using the same `getBaseURL()` helper from `server/utils/auth.ts`.
4. Backend generates a random nonce, stores it in a short-lived entry (the `mastodon_oauth_state` table with a 10-minute expiry), and builds the `state` parameter as base64-encoded JSON: `{ nonce, targetName, instanceUrl }`.
5. Frontend redirects user to `https://{instance}/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&scope=write:statuses+write:media&state=...`
6. User authorizes on their Mastodon instance.
7. Callback at `/api/targets/mastodon/callback` receives `code` + `state`. Verifies the nonce exists in `mastodon_oauth_state` and belongs to the authenticated user, then deletes it.
8. Exchanges code for access token via `POST https://{instance}/oauth/token`.
9. Queries `GET /api/v2/instance` to read `statuses.max_characters`.
10. Creates the target with credentials `{ instanceUrl, accessToken, maxCharacters }`.
11. Redirects user to `/targets/{id}`.

Mastodon access tokens do not expire by default, so no refresh token flow is needed.

## Per-Instance App Cache

A new `mastodon_app` table caches app registrations:

| Column | Type |
|--------|------|
| id | text PK |
| instanceUrl | text (unique) |
| clientId | text |
| clientSecret | text |
| createdAt | timestamp |

Looked up lazily: if a row exists for the instance, reuse it; otherwise register and insert. If token exchange fails with a 401, delete the cached entry so re-registration is attempted on the next try.

## OAuth State Table

A new `mastodon_oauth_state` table for CSRF protection:

| Column | Type |
|--------|------|
| id | text PK |
| nonce | text (unique) |
| userId | text |
| createdAt | timestamp |

Entries are deleted after use or when older than 10 minutes.

## Posting

`POST /api/v1/statuses` with `status` (text) and optional `media_ids[]`.

Image upload uses `POST /api/v1/media` (synchronous, simpler than v2's async flow). Accepts multipart form data with `file` and `description` fields, returns a `MediaAttachment` with an `id` to attach to the status.

## Character Limit & Truncation

Both Bluesky and Mastodon count grapheme clusters (Mastodon's server-side validator uses `each_grapheme_cluster.size`), so the existing `Intl.Segmenter`-based counting is correct for both.

Every target type must store its character limit in credentials as `maxCharacters`. Add a helper `getCharLimit(target)` that reads `maxCharacters` from `JSON.parse(credentials)` — no fallback. All call sites pass the result of this helper instead of hardcoding.

- **Bluesky**: store `maxCharacters: 300` in credentials when creating a target (via `POST /api/targets`)
- **Mastodon**: store `maxCharacters` read from `GET /api/v2/instance` → `statuses.max_characters` during OAuth flow

### URL counting

Mastodon counts every URL as 23 graphemes regardless of actual length. Bluesky counts URLs at their real grapheme length. This affects how much non-URL content fits in a post.

Add an optional `urlCost` parameter to `truncatePost`:

```ts
truncatePost(text, 300)                        // Bluesky: URLs at real length
truncatePost(text, maxCharacters, { urlCost: 23 })  // Mastodon: URLs at fixed 23
```

When `urlCost` is set, `truncatePost` finds all URLs in the text, counts each at `urlCost` graphemes instead of actual length, and allocates the remaining budget to non-URL content. The current implementation only handles a trailing URL — this extends it to handle all URLs in the text.

Call sites pass `urlCost` based on target type. Add a helper `getPostOptions(target)` that returns `{ maxCharacters, urlCost? }` from the target's type and credentials.

## Files

### New

- **`server/utils/mastodon.ts`** — `postToMastodon(credentials, text, images?)`, `registerMastodonApp(instanceUrl, redirectUri)`, `exchangeMastodonToken(instanceUrl, clientId, clientSecret, code, redirectUri)`, `fetchInstanceConfig(instanceUrl)`
- **`server/api/targets/mastodon/authorize.post.ts`** — accepts `{ instanceUrl, targetName }`, normalizes URL, registers app if needed, creates OAuth state entry, returns `{ url }` (the OAuth authorization URL)
- **`server/api/targets/mastodon/callback.get.ts`** — handles OAuth callback with `code` + `state`, verifies nonce, exchanges for token, reads instance config, creates target, redirects to `/targets/{id}`

### Modified

- **`server/db/schema.ts`** — add `mastodonApps` and `mastodonOauthState` tables
- **`server/tasks/feed/poll.ts`** — add `mastodon` branch in `postFn`, use `getCharLimit(target)` for truncation
- **`server/api/connections/[id]/test.post.ts`** — add `mastodon` branch, use `getCharLimit(target)`
- **`server/api/connections/[id]/post-item.post.ts`** — same
- **`server/api/post-log/[id]/retry.post.ts`** — same
- **`server/utils/poll.ts`** — `processConnectionItems` receives `maxCharacters` param instead of hardcoding 300
- **`app/pages/targets/new.vue`** — add Mastodon option with instance URL input + "Authorize with Mastodon" button that redirects to the OAuth flow
- **`app/pages/targets/[id].vue`** — add Mastodon display (shows instance URL, no editable credentials since they're OAuth-managed) + re-authorize option

- **`server/api/targets/index.post.ts`** — inject `maxCharacters: 300` into Bluesky credentials before storing, so all targets have a character limit in their credentials
- **`server/api/targets/[id].put.ts`** — same (inject `maxCharacters: 300` on Bluesky credential updates)

- **`server/utils/template.ts`** — extend `truncatePost` to accept an optional `{ urlCost }` options param; update URL handling to find all URLs in text and count them at `urlCost` when provided

## Scopes

Request `write:statuses` and `write:media` — minimum needed to post statuses with images.

## Database Migration

The `mastodon_app` and `mastodon_oauth_state` tables are added via Drizzle schema. Run `drizzle-kit generate` + `drizzle-kit migrate` after schema change.

### Data migration for existing Bluesky targets

Existing Bluesky targets in production don't have `maxCharacters` in their credentials. Add a one-time migration script that:

1. Selects all targets where `type = 'bluesky'`
2. Parses their `credentials` JSON
3. Adds `maxCharacters: 300`
4. Updates the row

This can be a Drizzle custom migration or a standalone script run once during deploy.
