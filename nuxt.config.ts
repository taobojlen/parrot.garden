import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxthub/core'],
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
    db: {
      dialect: 'sqlite',
      driver: 'd1',
      connection: { databaseId: '7d8c14ce-b905-4974-aced-b700006eff96' },
    },
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
})
