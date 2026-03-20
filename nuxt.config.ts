import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxthub/core', '@sentry/nuxt/module'],
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

  sentry: {
    org: 'mori-technologies',
    project: 'parrotgarden',
  },

  sourcemap: {
    client: 'hidden',
  },
})