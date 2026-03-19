import { render } from '@react-email/render'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { Resend } from 'resend'
import MagicLinkEmail from '../emails/magic-link'

let _auth: ReturnType<typeof betterAuth>

export function serverAuth() {
  if (!_auth) {
    _auth = betterAuth({
      database: drizzleAdapter(db, { provider: 'sqlite', schema }),
      baseURL: getBaseURL(),
      secret: useRuntimeConfig().betterAuthSecret,
      plugins: [
        magicLink({
          sendMagicLink: async ({ email, url }) => {
            const config = useRuntimeConfig()
            if (!config.resendApiKey) {
              // Dev fallback
              console.log(`[Magic Link] Send to ${email}: ${url}`)
              return
            }
            const resend = new Resend(config.resendApiKey)
            const html = await render(MagicLinkEmail({ url }))
            await resend.emails.send({
              from: config.resendFromEmail || 'Parrot <noreply@parrot.app>',
              to: email,
              subject: 'Sign in to Parrot',
              html,
            })
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
