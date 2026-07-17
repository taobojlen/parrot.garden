import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { deliverMagicLink, type EmailSender } from './email'

let _auth: any

export function serverAuth() {
  if (!_auth) {
    _auth = betterAuth({
      database: drizzleAdapter(db, { provider: 'sqlite', schema }),
      baseURL: getBaseURL(),
      secret: useRuntimeConfig().betterAuthSecret,
      plugins: [
        magicLink({
          sendMagicLink: async ({ email, url }) => {
            const sender = import.meta.dev
              ? undefined
              : useEvent().req.runtime.cloudflare.env.EMAIL as EmailSender | undefined

            await deliverMagicLink({
              email,
              url,
              isDevelopment: import.meta.dev,
              sender,
            })
          },
        }),
      ],
    })
  }
  return _auth
}

export function getBaseURL(): string {
  const config = useRuntimeConfig()
  if (config.betterAuthUrl) return config.betterAuthUrl
  try {
    return getRequestURL(useEvent()).origin
  }
  catch {
    return 'http://localhost:3000'
  }
}
