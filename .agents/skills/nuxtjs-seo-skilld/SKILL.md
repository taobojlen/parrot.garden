---
name: nuxtjs-seo-skilld
description: "ALWAYS use when writing code importing \"@nuxtjs/seo\". Consult for debugging, best practices, or modifying @nuxtjs/seo, nuxtjs/seo, nuxtjs seo, nuxt-seo, nuxt seo."
metadata:
  version: 4.0.2
  generated_by: Anthropic · Opus 4.6
  generated_at: 2026-03-22
---

# harlan-zw/nuxt-seo `@nuxtjs/seo`

**Version:** 4.0.2
**Deps:** @nuxt/kit@^4.4.2, @nuxtjs/robots@^5.7.1, @nuxtjs/sitemap@^7.6.0, nuxt-link-checker@^4.3.9, nuxt-og-image@^6.0.5, nuxt-schema-org@^5.0.10, nuxt-seo-utils@^7.0.19, nuxt-site-config@^3.2.21
**Tags:** latest: 4.0.2

**References:** [package.json](./.skilld/pkg/package.json) — exports, entry points • [README](./.skilld/pkg/README.md) — setup, basic usage • [Docs](./.skilld/docs/_INDEX.md) — API reference, guides • [GitHub Issues](./.skilld/issues/_INDEX.md) — bugs, workarounds, edge cases • [GitHub Discussions](./.skilld/discussions/_INDEX.md) — Q&A, patterns, recipes • [Releases](./.skilld/releases/_INDEX.md) — changelog, breaking changes, new APIs

## Search

Use `skilld search` instead of grepping `.skilld/` directories — hybrid semantic + keyword search across all indexed docs, issues, and releases. If `skilld` is unavailable, use `npx -y skilld search`.

```bash
skilld search "query" -p @nuxtjs/seo
skilld search "issues:error handling" -p @nuxtjs/seo
skilld search "releases:deprecated" -p @nuxtjs/seo
```

Filters: `docs:`, `issues:`, `releases:` prefix narrows by source type.

<!-- skilld:best-practices -->
## Best Practices

- Set `url`, `name`, `description`, and `defaultLocale` in the `site` key of `nuxt.config.ts` -- this shared config feeds all 6 sub-modules (sitemap, robots, schema.org, og-image, link-checker, seo-utils) so they stay consistent without per-module duplication. Omit `defaultLocale` if `@nuxtjs/i18n` is installed since it provides it automatically [source](./.skilld/docs/content/2.guides/0.using-the-modules.md:L99:L115)

- Use `useSeoMeta()` instead of `useServerSeoMeta()` for per-page descriptions -- `useServerSeoMeta` only sets meta server-side, and the SEO Utils client-side plugin will overwrite it with the `site.description` fallback on hydration. The maintainer has noted `useServer*` composables may be deprecated in Unhead v2 [source](./.skilld/issues/issue-389.md:L56:L58)

- When using Nuxt Content v3, load `@nuxtjs/seo` before `@nuxt/content` in the `modules` array -- the module order matters because `asSeoCollection()` augments content collections, and the SEO module must register its schemas before Content processes them [source](./.skilld/docs/content/2.guides/2.nuxt-content.md:L66:L76)

- Wrap Nuxt Content v3 collections with `asSeoCollection()` from `@nuxtjs/seo/content` instead of composing individual `asSitemapCollection`/`asSchemaOrgCollection`/etc -- the unified helper applies all SEO collection augmentations in one call and avoids the composition problem where individual wrappers cannot be nested [source](./.skilld/docs/content/2.guides/2.nuxt-content.md:L27:L44)

- Disable `nuxt-og-image` via `ogImage: { enabled: false }` if you are not using dynamic OG images -- it is opt-in (does nothing by default) but still adds 2-5MB to the server bundle. In serverless environments targeting sub-1MB workers, either disable it or use Zero Runtime mode to prerender images at build time [source](./.skilld/docs/content/1.getting-started/3.troubleshooting.md:L33:L36)

- Disable individual sub-modules using their config key's `enabled: false` rather than removing `@nuxtjs/seo` from modules -- the config keys are `ogImage`, `sitemap`, `robots`, `seo` (for seo-utils), `schemaOrg`, and `linkChecker` [source](./.skilld/docs/content/2.guides/1.disabling-modules.md:L9:L16)

- For i18n sitemaps with dynamic URLs from a CMS, assign the `_sitemap` property to the locale code on each URL entry to route it into the correct per-locale sitemap -- the sitemap module auto-generates a multi-sitemap with one per locale, and `_sitemap` controls which sitemap a dynamic URL belongs to [source](./.skilld/discussions/discussion-167.md:L22:L30)

- After rendering Nuxt Content v3 pages, explicitly call `useHead(page.value.head)`, `useSeoMeta(page.value.seo)`, and `defineOgImage(page.value.ogImage)` in your catch-all page component -- `asSeoCollection` populates these fields on the content object but does not auto-inject them into the page head [source](./.skilld/docs/content/2.guides/2.nuxt-content.md:L48:L63)

- Use `definePageMeta()` for per-page robots and sitemap rules (added in v3.4.0) instead of route rules in `nuxt.config.ts` -- this co-locates SEO config with the page component and supports i18n custom route path expansion automatically [source](./.skilld/releases/v3.4.0.md:L12:L13)

- Upgrade with `npx nuxt upgrade --dedupe` rather than manually bumping the `@nuxtjs/seo` version -- this deduplicates the lockfile and pulls in required updates from the unjs ecosystem that Nuxt SEO depends on, preventing version mismatch issues like the Zod v4 crash in `asSeoCollection` [source](./.skilld/releases/v4.0.0.md:L24:L30)
<!-- /skilld:best-practices -->
