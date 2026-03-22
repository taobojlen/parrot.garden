# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start development server
pnpm build            # Production build (4GB memory allocation)
pnpm preview          # Preview production build

npx vitest            # Run all tests
npx vitest run        # Run tests once (no watch)
npx vitest run tests/unit/template.test.ts  # Run a single test file

npx eslint .          # Lint
npx drizzle-kit generate  # Generate DB migration after schema changes
npx drizzle-kit migrate   # Apply migrations
```

## Architecture

**parrot.garden** is a Nuxt 4 full-stack app implementing the POSSE pattern (Publish Own Site, Syndicate Elsewhere). Users connect RSS feed **Sources** to social platform **Targets** via **Connections** that use templates to format posts.

### Data flow

RSS Source → (feed:poll task every 5min) → parse items → render template → post to Bluesky/Mastodon Target

### Stack

- **Frontend:** Vue 3 + Nuxt 4, Tailwind CSS v4, @nuxt/ui
- **Backend:** Nitro server routes under `server/api/`
- **Database:** Drizzle ORM + SQLite (Cloudflare D1 in prod, local SQLite in dev)
- **Auth:** better-auth with magic link (email via Resend)
- **Deployment:** Cloudflare Workers via @nuxthub/core
- **Monitoring:** Sentry

### Key directories

- `app/pages/` — File-based routing (landing, login, dashboard, CRUD for sources/targets/connections, log)
- `app/components/` — Shared components (ConfirmModal, GlassButton, TemplatePreview, TemplateVariables)
- `app/composables/auth.ts` — Client-side auth (useSession, signIn, signOut from better-auth/vue)
- `server/api/` — API routes organized by resource (sources, targets, connections, post-log, auth)
- `server/utils/` — Core logic: RSS parsing, template rendering, Bluesky/Mastodon posting, polling, batching
- `server/db/schema.ts` — Drizzle schema (sources, targets, connections, sourceItems, postLogs, mastodon OAuth tables)
- `server/tasks/feed/` — Scheduled Nitro task for feed polling
- `server/emails/` — React Email templates (magic link)
- `tests/unit/` — Vitest unit tests for server utils

### Important patterns

- **Template rendering:** `{{title}}`, `{{link}}`, `{{description}}`, `{{content}}`, `{{author}}`, `{{date}}` variables with grapheme-aware truncation. Bluesky max 300 chars; Mastodon URLs cost 23 chars.
- **D1 batch limits:** Writes are batched (7 post_log rows, 25 source_item rows per batch) due to Cloudflare D1 constraints.
- **New connections only post new items:** `filterNewItems` ensures items discovered before a connection was created are not posted.
- **Auth guard:** `app/middleware/auth.global.ts` protects all routes except `/` and `/login`.
- **Glass morphism UI:** Consistent visual theme using backdrop blur, saturation, and layered box shadows defined in `app/assets/css/main.css`.

### Runtime config (env vars)

`NUXT_BETTER_AUTH_SECRET`, `NUXT_BETTER_AUTH_URL`, `NUXT_RESEND_API_KEY`, `NUXT_RESEND_FROM_EMAIL`

<!-- skilld -->
Before modifying code, evaluate each installed skill against the current task.
For each skill, determine YES/NO relevance and invoke all YES skills before proceeding.
<!-- /skilld -->
