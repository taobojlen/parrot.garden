# RSS Feed Discovery on Source Creation

## Problem

When creating a new Source, users must provide a direct RSS/Atom feed URL. Many users know their site URL (e.g., `https://btao.org/`) but not the exact feed URL. The app should discover feeds automatically from any page URL.

## Design

### Server Utility: `discoverFeeds(url: string)`

Located in `server/utils/rss.ts` (extending existing RSS utilities).

**Logic:**

1. Fetch the URL
2. Try parsing the response as RSS/Atom using existing `parseFeed` logic
3. If valid feed → return `{ type: 'feed', url }`
4. If not a feed, parse the response body as HTML and extract `<link rel="alternate">` elements with `type="application/rss+xml"` or `type="application/atom+xml"`
5. If one or more feeds discovered → return `{ type: 'discovered', feeds: [{ url, title }] }`
6. If no feeds found → throw error: "No RSS feeds found on this page"

**Return type:**

```typescript
type DiscoverResult =
  | { type: 'feed'; url: string }
  | { type: 'discovered'; feeds: Array<{ url: string; title: string }> }
```

**Notes:**

- Always attempt `parseFeed` first regardless of Content-Type; catch parse errors and fall through to HTML link discovery
- Use an HTML parsing library (e.g., `node-html-parser` or `cheerio`) to extract `<link>` tags from the HTML
- Resolve relative feed URLs against the page URL using `new URL(href, pageUrl)`
- Extract `href` and `title` attributes from each `<link>` element; if `title` is missing, use the feed URL as the display title
- Discovered feed validation defers to the existing `POST /api/sources` create endpoint — `discoverFeeds` does not validate that discovered URLs are actually working feeds

### API Endpoint: `POST /api/sources/discover`

Located in `server/api/sources/discover.post.ts`.

- Requires authentication via `requireAuth()`
- Accepts `{ url: string }` in request body
- Delegates to `discoverFeeds(url)`
- Returns the `DiscoverResult` object
- Throws 400 on validation errors, surfaces fetch/parse errors

### Form Flow: `app/pages/sources/new.vue`

Two-phase source creation:

1. User enters any URL (site or feed) and clicks a discover/find button
2. Form calls `POST /api/sources/discover`
3. **Direct feed or single discovered feed:** auto-populate the feed URL and proceed to the standard create flow
4. **Multiple discovered feeds:** show radio buttons listing each feed's title and URL; user selects one, then proceeds to create
5. `POST /api/sources` (existing endpoint) receives the validated feed URL — no changes needed to the create endpoint

The `name` field remains user-provided. After discovery, the URL field becomes read-only (user can reset to try a different URL).

### Error Handling

- URL not reachable → surface the fetch error message
- URL is HTML with no feed links → "No RSS feeds found on this page"
- URL is neither valid RSS nor HTML with feeds → "No RSS feeds found on this page"

### Testing

Unit tests for `discoverFeeds`:

- Direct RSS feed URL → returns `{ type: 'feed', url }`
- HTML page with one `<link rel="alternate" type="application/rss+xml">` → returns single discovered feed
- HTML page with one `<link rel="alternate" type="application/atom+xml">` → returns single discovered feed (Atom)
- HTML page with multiple feed links (mixed RSS and Atom) → returns all discovered feeds with titles
- HTML page with feed link missing `title` attribute → uses URL as fallback title
- HTML page with no feed links → throws error
- Unreachable URL → throws error
- Relative feed URLs resolved against page URL

## Scope

- Only applies to source **creation**, not editing
- No changes to the existing `POST /api/sources` create endpoint
- No changes to feed polling or template rendering
