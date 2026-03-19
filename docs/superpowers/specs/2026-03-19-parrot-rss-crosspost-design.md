# Parrot — RSS Cross-Posting Service

## Overview

Parrot is a web service that reads RSS feeds and cross-posts new items to social platforms (Bluesky initially, Mastodon etc. later). Built on Nuxt 4 with NuxtHub, deployed to Cloudflare Workers (paid plan / NuxtHub Pro for sufficient CPU time).

## Authentication

- **Better Auth** with magic link (passwordless email) sign-in
- Session and user data stored in D1 (Better Auth's SQLite adapter)
- Better Auth manages `user`, `session`, and `verification` tables

## Data Model

All data in Cloudflare D1 via NuxtHub.

### `user` / `session` / `verification`

Managed by Better Auth. We don't modify these schemas directly.

### `source`

An RSS feed to watch.

| Column    | Type      | Notes              |
|-----------|-----------|--------------------|
| id        | TEXT PK   | UUID               |
| userId    | TEXT FK   | → user.id          |
| name      | TEXT      | Display name       |
| url       | TEXT      | RSS feed URL       |
| createdAt | TIMESTAMP |                    |
| updatedAt | TIMESTAMP |                    |

Source creation validates the URL by fetching and parsing the feed. Returns an error if the URL is not a valid RSS/Atom feed.

### `target`

A destination account on a social platform.

| Column      | Type      | Notes                                      |
|-------------|-----------|--------------------------------------------|
| id          | TEXT PK   | UUID                                       |
| userId      | TEXT FK   | → user.id                                  |
| type        | TEXT      | Platform type: `'bluesky'`, `'mastodon'`   |
| name        | TEXT      | Display name                               |
| credentials | TEXT      | JSON blob, structure varies by type        |
| createdAt   | TIMESTAMP |                                            |
| updatedAt   | TIMESTAMP |                                            |

**Credentials by type:**
- Bluesky: `{ "handle": "...", "appPassword": "..." }`
- Mastodon (future): `{ "instanceUrl": "...", "accessToken": "..." }`

Credentials are stored as plain JSON. D1 provides encryption at rest.

### `connection`

Links a source to a target with a template.

| Column    | Type      | Notes                |
|-----------|-----------|----------------------|
| id        | TEXT PK   | UUID                 |
| userId    | TEXT FK   | → user.id            |
| sourceId  | TEXT FK   | → source.id          |
| targetId  | TEXT FK   | → target.id          |
| template  | TEXT      | Template string      |
| enabled   | BOOLEAN   | Whether active       |
| createdAt | TIMESTAMP |                      |
| updatedAt | TIMESTAMP |                      |

Connection creation must verify that the current user owns both the source and the target. The `userId` column enables direct auth scoping without joins.

### `post_log`

Tracks what has been posted for idempotency and history.

| Column       | Type      | Notes                                    |
|--------------|-----------|------------------------------------------|
| id           | TEXT PK   | UUID                                     |
| connectionId | TEXT FK   | → connection.id                          |
| itemGuid     | TEXT      | RSS item GUID or link                    |
| itemTitle    | TEXT      | RSS item title                           |
| itemLink     | TEXT      | RSS item URL                             |
| status       | TEXT      | `'posted'`, `'failed'`, `'skipped'`      |
| attempts     | INTEGER   | Number of post attempts (default 0)      |
| error        | TEXT      | Error message if failed, NULL otherwise  |
| postedAt     | TIMESTAMP |                                          |
| updatedAt    | TIMESTAMP |                                          |

**UNIQUE constraint** on `(connectionId, itemGuid)` — this is the idempotency mechanism.

### Relationships

- user 1→∞ source
- user 1→∞ target
- source 1→∞ connection ∞←1 target
- connection 1→∞ post_log

### Delete behavior

- Deleting a source cascade-deletes its connections and their post_log entries.
- Deleting a target cascade-deletes its connections and their post_log entries.
- Deleting a connection cascade-deletes its post_log entries.

## Templating

Simple variable interpolation with `{{variable}}` syntax.

### Available variables

| Variable        | Description                    |
|-----------------|--------------------------------|
| `{{title}}`     | RSS item title                 |
| `{{link}}`      | RSS item URL                   |
| `{{description}}`| RSS item description (HTML stripped) |
| `{{author}}`    | RSS item author                |
| `{{date}}`      | RSS item publication date (ISO 8601 date: `2026-03-19`) |

### Default templates by target type

- **Bluesky:** `{{title}} {{link}}`

### Truncation and Bluesky rich text

Bluesky posts have a limit of **300 graphemes** (not characters). Links in Bluesky posts are rendered as **facets** — the `@atproto/api` RichText class handles detection of URLs in post text and converts them to link facets automatically. The full URL text is present in the post body and counts toward the grapheme limit.

Truncation logic:
1. Render the template with all variables
2. If it fits within the grapheme limit, done
3. If it exceeds the limit **and the rendered text ends with a URL**, truncate the text before the URL with `…` so that `… ` + URL fits within the limit
4. If it exceeds the limit **and does not end with a URL**, truncate from the end with `…`
5. Use `@atproto/api` `RichText` to detect facets after truncation

## Cron Flow

Cloudflare cron trigger runs every 5 minutes, hitting `server/routes/_cron/poll.ts`.

### Steps

1. Fetch all enabled connections (join source + target)
2. Group by unique source URL, fetch each RSS feed once
3. For each connection:
   - Get the 10 newest items from the feed
   - Check `post_log` for each item — skip if a record exists with `status = 'posted'` or `'skipped'`
   - For items not in `post_log`:
     - Render template with item variables
     - Truncate to target's grapheme limit, preserving link
     - Post to target via its API
     - Insert into `post_log` with `'posted'` or `'failed'` + error, `attempts = 1`
4. For items in `post_log` with `status = 'failed'` and `attempts < 5`:
   - Retry posting
   - Increment `attempts`
   - Update status to `'posted'` or leave as `'failed'` with updated error
   - After 5 failed attempts, stop retrying (item stays as `'failed'`, visible in the log UI for manual retry)

### Error classification

- **Retryable** (5xx, network errors, rate limits): increment attempts, retry next cron run
- **Permanent** (401 auth error, 400 content policy): set `attempts = 5` immediately to stop retrying, log the error. The user can fix credentials and manually retry from the UI.

### Initial sync behavior

When a connection is first created (in the POST `/api/connections` handler), we synchronously fetch the feed and insert all current items into `post_log` with `status = 'skipped'`. This prevents backfilling historical posts and avoids a race window between connection creation and the first cron run.

### Cron endpoint security

The `/_cron/poll` route verifies the request comes from Cloudflare's cron infrastructure by checking for the `CF-Cron` header. External requests return 403.

## Server Routes

| Route                          | Method | Purpose                        |
|--------------------------------|--------|--------------------------------|
| `/api/auth/[...all]`          | *      | Better Auth catch-all          |
| `/api/sources`                | GET    | List user's sources            |
| `/api/sources`                | POST   | Create source (validates feed) |
| `/api/sources/[id]`           | GET    | Get source                     |
| `/api/sources/[id]`           | PUT    | Update source                  |
| `/api/sources/[id]`           | DELETE | Delete source                  |
| `/api/targets`                | GET    | List user's targets            |
| `/api/targets`                | POST   | Create target                  |
| `/api/targets/[id]`           | GET    | Get target                     |
| `/api/targets/[id]`           | PUT    | Update target                  |
| `/api/targets/[id]`           | DELETE | Delete target                  |
| `/api/connections`            | GET    | List user's connections        |
| `/api/connections`            | POST   | Create connection + initial sync |
| `/api/connections/[id]`       | GET    | Get connection                 |
| `/api/connections/[id]`       | PUT    | Update connection              |
| `/api/connections/[id]`       | DELETE | Delete connection              |
| `/api/post-log`               | GET    | List post history              |
| `/api/post-log/[id]/retry`    | POST   | Retry a failed post            |
| `/_cron/poll`                 | GET    | Cron trigger endpoint (internal only) |

All `/api/` routes (except auth) require authentication and scope data to the current user.

## Pages

| Path                   | Purpose                                    |
|------------------------|--------------------------------------------|
| `/`                    | Landing page                               |
| `/login`               | Magic link sign-in                         |
| `/dashboard`           | List sources, targets, connections         |
| `/sources/new`         | Add RSS source                             |
| `/sources/[id]`        | Edit source                                |
| `/targets/new`         | Add target (type-specific form)            |
| `/targets/[id]`        | Edit target                                |
| `/connections/new`     | Create connection (pick source, target, template) |
| `/connections/[id]`    | Edit connection                            |
| `/log`                 | Post history with status and retry         |

UI built with **Nuxt UI** components.

## Key Dependencies

| Package            | Purpose                              |
|--------------------|--------------------------------------|
| `better-auth`      | Authentication (magic link)          |
| `@atproto/api`     | Bluesky AT Protocol client           |
| `fast-xml-parser`  | Parse RSS/Atom feeds (Workers-compatible, no Node.js deps) |

We use `fast-xml-parser` for RSS/Atom parsing with a thin wrapper to normalize RSS 2.0 and Atom fields into a common item shape (`guid`, `title`, `link`, `description`, `author`, `pubDate`). This library uses only string operations and works in Cloudflare Workers.

## Technical Constraints

- **Cloudflare Workers runtime** — no Node.js APIs, must use Web APIs
- **Deployment tier** — Workers paid plan / NuxtHub Pro required for sufficient CPU time (30s CPU per invocation)
- **D1 limits** — 10GB storage, 5M rows free tier (more than sufficient)
- **Cron limits** — minimum 1 minute interval, we use 5 minutes
- **Bluesky post limit** — 300 graphemes, rich text with facets for links
- **Workers CPU time** — 30s on paid plan; cron processes feeds sequentially to stay within limits

## Security

- All API routes scoped to authenticated user
- Connection creation verifies ownership of both source and target
- Credentials stored as plain JSON in D1 (encrypted at rest by Cloudflare)
- Magic link tokens managed by Better Auth with expiration
- CSRF protection via Better Auth
- Cron endpoint rejects external requests
