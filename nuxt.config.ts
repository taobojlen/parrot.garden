import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preload', as: 'image', href: '/hero-canopy.png' },
      ],
    },
  },

  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxthub/core', '@nuxtjs/seo',
    ...(process.env.POSTHOG_PUBLIC_KEY ? ['@posthog/nuxt'] : []),
  ],
  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      include: [
        'better-auth/vue',
        'better-auth/client/plugins',
        'posthog-js',
      ],
    },
  },

  hub: {
    db: 'sqlite',
  },

  nitro: {
    preset: 'cloudflare_module',
    rollupConfig: {
      output: {
        sourcemapExcludeSources: false,
      },
    },
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '*/5 * * * *': ['feed:poll'],
    },
  },

  runtimeConfig: {
    betterAuthSecret: '',
    betterAuthUrl: '',
    emailFrom: 'noreply@parrot.garden',
  },

  posthogConfig: {
    publicKey: process.env.POSTHOG_PUBLIC_KEY || '',
    host: process.env.POSTHOG_CLI_HOST || process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    clientConfig: {
      api_host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      defaults: '2026-01-30',
      capture_exceptions: true,
    },
    serverConfig: {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      enableExceptionAutocapture: true,
    },
    sourcemaps: {
      enabled: Boolean(process.env.POSTHOG_CLI_API_KEY && process.env.POSTHOG_CLI_PROJECT_ID),
      personalApiKey: process.env.POSTHOG_CLI_API_KEY,
      projectId: process.env.POSTHOG_CLI_PROJECT_ID,
    },
  },

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://parrot.garden',
    name: 'parrot.garden',
    description: 'POSSE your content — automatically syndicate your RSS feeds to Bluesky, Mastodon, and more. Publish on your own site, share everywhere.',
    defaultLocale: 'en',
  },

  ogImage: {
    enabled: false,
  },

  linkChecker: {
    enabled: false,
  },

  robots: {
    disallow: ['/dashboard', '/sources', '/targets', '/connections', '/log', '/login'],
  },

  sitemap: {
    zeroRuntime: true,
    exclude: ['/dashboard', '/sources/**', '/targets/**', '/connections/**', '/log', '/login', '/og-image'],
  },

  sourcemap: {
    client: 'hidden',
  },
})
