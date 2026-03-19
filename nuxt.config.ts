// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxthub/core'],
  hub: {
    database: true,
  },
  nitro: {
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
  },
})
