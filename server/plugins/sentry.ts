import { sentryCloudflareNitroPlugin } from '@sentry/nuxt/module/plugins'

export default defineNitroPlugin(sentryCloudflareNitroPlugin({
  dsn: 'https://cfee62ef6500fdfeb222294f1a764a31@o1417973.ingest.us.sentry.io/4511071565250560',
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
}))
