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

  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxthub/core', '@sentry/nuxt/module', '@nuxtjs/seo'],
  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [
      tailwindcss(),
    ],
    optimizeDeps: {
      include: [
        'better-auth/vue',
        'better-auth/client/plugins',
      ],
    },
  },

  hub: {
    db: 'sqlite',
  },

  nitro: {
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
        compatibility_flags: ['nodejs_compat'],
        d1_databases: [
          { binding: 'DB', database_id: '7d8c14ce-b905-4974-aced-b700006eff96' },
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
    resendApiKey: '',
    resendFromEmail: '',
  },

  site: {
    url: 'https://parrot.garden',
    name: 'parrot.garden',
    description: 'Cross-post your RSS feeds to Bluesky, Mastodon, and more. Automatically share your blog posts and content across social media platforms.',
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
    exclude: ['/dashboard', '/sources/**', '/targets/**', '/connections/**', '/log', '/login'],
  },

  sentry: {
    org: 'mori-technologies',
    project: 'parrotgarden',
  },

  sourcemap: {
    client: 'hidden',
  },
})