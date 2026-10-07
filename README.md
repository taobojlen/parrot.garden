# parrot.garden

Automatically share your blog posts to social media. **parrot.garden** connects RSS feeds to Bluesky and Mastodon, posting new items as they appear — an implementation of the [POSSE](https://indieweb.org/POSSE) pattern (Publish Own Site, Syndicate Elsewhere).

## How it works

1. Add an RSS feed as a **Source**
2. Connect a Bluesky or Mastodon account as a **Target**
3. Create a **Connection** between a source and target with a customizable template
4. New feed items are automatically posted to your social accounts every 5 minutes

Templates support variables like `{{title}}`, `{{link}}`, `{{description}}`, `{{content}}`, `{{author}}`, and `{{date}}` with automatic truncation to fit platform character limits.

## Stack

- **Frontend:** Vue 3 + Nuxt 4, Tailwind CSS v4, Nuxt UI
- **Backend:** Nitro server routes
- **Database:** Drizzle ORM + SQLite (Cloudflare D1 in production)
- **Auth:** better-auth with magic link email (via Cloudflare Email Service)
- **Deployment:** Cloudflare Workers via NuxtHub

## Development

### Setup

```bash
pnpm install
```

### Dev server

```bash
pnpm dev
```

Starts the development server at `http://localhost:3000`.

### Environment variables

Create a `.env` file with:

```
NUXT_BETTER_AUTH_SECRET=
NUXT_BETTER_AUTH_URL=
```

Production email is sent through the Worker's `EMAIL` binding. The `parrot.garden` domain must be onboarded in Cloudflare Email Service; no email API key is required.

PostHog captures browser, Vue, and Nitro request exceptions through `@posthog/nuxt`. Events use `https://ph.btao.org`.

For readable production stack traces, set these build-time environment variables:

- `POSTHOG_CLI_HOST`: the PostHog API host for your region (for example, `https://us.posthog.com` or `https://eu.posthog.com`), not an ingestion-only proxy.
- `POSTHOG_CLI_PROJECT_ID`: your PostHog project ID.
- `POSTHOG_CLI_API_KEY`: a personal API key with `organization:read` and `error_tracking:write` scopes.

Source-map uploads run during production builds when the project ID and personal API key are set. The key stays out of runtime config and client bundles. Without these credentials, exception capture still works, but source maps are not uploaded. Check the build logs for upload failures and verify errors in PostHog after deployment.

### Testing

```bash
npx vitest            # Watch mode
npx vitest run        # Run once
```

### Build

```bash
pnpm build            # Production build
pnpm preview          # Preview production build locally
```

### Database migrations

```bash
npx drizzle-kit generate  # Generate migration after schema changes
npx drizzle-kit migrate   # Apply migrations
```
