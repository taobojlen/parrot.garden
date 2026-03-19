import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'

let _auth: ReturnType<typeof betterAuth>

export function serverAuth() {
  if (!_auth) {
    _auth = betterAuth({
      database: drizzleAdapter(db, { provider: 'sqlite' }),
      baseURL: getBaseURL(),
      secret: useRuntimeConfig().betterAuthSecret,
      plugins: [
        magicLink({
          sendMagicLink: async ({ email, url }) => {
            // TODO: integrate email service for production
            console.log(`[Magic Link] Send to ${email}: ${url}`)
          },
        }),
      ],
    })
  }
  return _auth
}

function getBaseURL(): string {
  const config = useRuntimeConfig()
  if (config.betterAuthUrl) return config.betterAuthUrl
  try {
    return getRequestURL(useEvent()).origin
  }
  catch {
    return 'http://localhost:3000'
  }
}
