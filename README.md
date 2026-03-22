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
- **Auth:** better-auth with magic link email (via Resend)
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
NUXT_RESEND_API_KEY=
NUXT_RESEND_FROM_EMAIL=
```

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
