import { render } from '@react-email/render'
import MagicLinkEmail from '../emails/magic-link'

export interface MagicLinkMessage {
  from: {
    name: string
    email: string
  }
  to: string
  subject: string
  html: string
  text: string
}

export interface EmailSender {
  send(message: MagicLinkMessage): Promise<unknown>
}

interface Nitro2CloudflareEvent {
  context: {
    cloudflare?: {
      env?: {
        EMAIL?: EmailSender
      }
    }
  }
}

interface DeliverMagicLinkOptions {
  email: string
  url: string
  isDevelopment: boolean
  sender?: EmailSender
  log?: (message: string) => void
}

export function getCloudflareEmailSender(
  event: Nitro2CloudflareEvent,
): EmailSender | undefined {
  return event.context.cloudflare?.env?.EMAIL
}

export async function sendMagicLinkEmail(
  sender: EmailSender,
  email: string,
  url: string,
): Promise<void> {
  const [html, text] = await Promise.all([
    render(MagicLinkEmail({ url })),
    render(MagicLinkEmail({ url }), { plainText: true }),
  ])

  await sender.send({
    from: {
      name: 'parrot.garden',
      email: 'noreply@parrot.garden',
    },
    to: email,
    subject: 'Sign in to parrot.garden',
    html,
    text,
  })
}

export async function deliverMagicLink({
  email,
  url,
  isDevelopment,
  sender,
  log = console.log,
}: DeliverMagicLinkOptions): Promise<void> {
  if (isDevelopment) {
    log(`[Magic Link] Send to ${email}: ${url}`)
    return
  }

  if (!sender) {
    throw new Error('Cloudflare EMAIL binding is not configured')
  }

  await sendMagicLinkEmail(sender, email, url)
}
