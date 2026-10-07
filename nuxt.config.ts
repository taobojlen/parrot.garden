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

  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxthub/core', '@posthog/nuxt', '@nuxtjs/seo'],
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
    cloudflare: {
      wrangler: {
        name: 'parrot',
        workers_dev: false,
        compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
        d1_databases: [
          { binding: 'DB', database_id: '7d8c14ce-b905-4974-aced-b700006eff96' },
        ],
        send_email: [
          {
            name: 'EMAIL',
            allowed_sender_addresses: ['noreply@parrot.garden'],
          },
        ],
        observability: {
          logs: {
            enabled: true,
            invocation_logs: true,
          },
        },
        triggers: {
          crons: ['*/5 * * * *'],
        },
      },
    },
  },

  runtimeConfig: {
    betterAuthSecret: '',
    betterAuthUrl: '',
  },

  posthogConfig: {
    publicKey: 'phc_Gpo6CeYuXk1aGfUIrsUwlSCdrfLx5W5tSpViXQR0GwM',
    host: process.env.POSTHOG_CLI_HOST || 'https://ph.btao.org',
    clientConfig: {
      api_host: 'https://ph.btao.org',
      defaults: '2026-01-30',
      capture_exceptions: true,
    },
    serverConfig: {
      host: 'https://ph.btao.org',
      enableExceptionAutocapture: true,
    },
    sourcemaps: {
      enabled: Boolean(process.env.POSTHOG_CLI_API_KEY && process.env.POSTHOG_CLI_PROJECT_ID),
      personalApiKey: process.env.POSTHOG_CLI_API_KEY,
      projectId: process.env.POSTHOG_CLI_PROJECT_ID,
    },
  },

  site: {
    url: 'https://parrot.garden',
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
