# parrot.garden

Automatically share your blog posts to social media. **parrot.garden** connects RSS feeds to Bluesky and Mastodon, posting new items as they appear — an implementation of the [POSSE](https://indieweb.org/POSSE) pattern (Publish Own Site, Syndicate Elsewhere).

## Self-host on Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/taobojlen/parrot.garden)

You need a Cloudflare account and a domain onboarded for outbound sending in [Cloudflare Email Service](https://developers.cloudflare.com/email-service/). The button provisions the Worker and D1 database; it does not onboard your email domain. Cloudflare usage charges apply.

1. Onboard your email domain in Cloudflare Email Service and choose a sender address, such as `noreply@your-domain.example`.
2. Click the button and choose a repository, Worker name, and database name.
3. Set `NUXT_BETTER_AUTH_SECRET` to a random value generated with `openssl rand -base64 32`. Set `NUXT_EMAIL_FROM` to your onboarded sender address. Keep the authentication secret private and stable across deployments.
4. Set `NUXT_BETTER_AUTH_URL` to your instance's HTTPS address, not the development address from `.env.example`. Use a custom domain or the `https://<worker-name>.<account-subdomain>.workers.dev` address. Set `NUXT_PUBLIC_SITE_URL` to the same address in the build environment.
5. Use `pnpm run build` as the build command and `pnpm run deploy` as the deploy command. The deploy command applies migrations to the provisioned `DB` binding before publishing the Worker.
6. Verify the Worker has the `DB` and `EMAIL` bindings and a five-minute cron trigger. Open your instance and request a sign-in email.

Authentication and sender settings must be available as Worker variables/secrets, not only build variables. If the setup flow does not populate them, add them under the Worker's Settings → Variables and Secrets. If you change the public address, update both URL settings and rebuild.

Leave the optional PostHog fields empty in the deployment setup. Analytics is disabled unless you set `POSTHOG_PUBLIC_KEY` in the build environment. Configure PostHog and source-map credentials only in the build environment, as described below.

### Deploy from the command line

Install dependencies and authenticate Wrangler:

```bash
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm exec wrangler d1 create parrot-db
```

Put the returned database ID in the `DB` entry in `wrangler.jsonc`. Set your instance URL in the build environment. Add `NUXT_BETTER_AUTH_URL` and `NUXT_EMAIL_FROM` under `vars` in `wrangler.jsonc`, then upload the authentication secret through Wrangler's private prompt:

```bash
pnpm exec wrangler secret put NUXT_BETTER_AUTH_SECRET --config wrangler.jsonc
pnpm build
pnpm run deploy
```

Use the root `wrangler.jsonc` for deployment and migrations. Its paths point to build output. For an existing deployment, set its database ID before deploying so Wrangler does not create a different database. Do not commit authentication secrets.

The hosted parrot.garden service uses `pnpm run deploy:production`. This selects the `production` environment in `wrangler.jsonc`, binds the existing database, disables `workers.dev`, and restricts the email sender to `noreply@parrot.garden`. Self-hosted instances use `pnpm run deploy` without this environment. Confirm production migration history in `_hub_migrations` before enabling automatic migrations against an existing database.

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

See `.env.example` for the complete environment configuration. Development prints sign-in links to the server console without sending email.

Production email is sent through the Worker's `EMAIL` binding. Set `NUXT_EMAIL_FROM` to an address on your onboarded Cloudflare Email Service domain; no email API key is required. The default sender is `noreply@parrot.garden`.

To enable PostHog browser, Vue, and Nitro request exception capture, set `POSTHOG_PUBLIC_KEY` at build time to your project's public key. Set `POSTHOG_HOST` to your ingestion host (defaults to `https://us.i.posthog.com`). Leave the public key empty to disable PostHog. For the hosted parrot.garden service, use its project public key and `POSTHOG_HOST=https://ph.btao.org`.

For readable production stack traces, set these build-time environment variables:

- `POSTHOG_CLI_HOST`: the PostHog API host for your region (for example, `https://us.posthog.com` or `https://eu.posthog.com`), not an ingestion-only proxy.
- `POSTHOG_CLI_PROJECT_ID`: your PostHog project ID.
- `POSTHOG_CLI_API_KEY`: a personal API key with `organization:read` and `error_tracking:write` scopes.

When PostHog is enabled, source-map uploads run during production builds when the project ID and personal API key are set. Keep the personal API key in the build environment, not Worker variables/secrets or client bundles. Without these credentials, exception capture still works, but source maps are not uploaded. Check the build logs for upload failures and verify errors in PostHog after deployment.

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
pnpm exec nuxt db generate  # Generate migration after schema changes
pnpm exec nuxt db migrate   # Apply migrations to the local development database
```

Cloudflare builds copy migrations into `.output/server/db/migrations/sqlite`. `pnpm run deploy` applies them remotely using the `DB` binding and `_hub_migrations` tracking table. Remote commands modify the selected Cloudflare database.
