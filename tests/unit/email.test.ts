import { describe, expect, it, vi } from 'vitest'
import {
  deliverMagicLink,
  type EmailSender,
  getCloudflareEmailSender,
  sendMagicLinkEmail,
} from '../../server/utils/email'

describe('sendMagicLinkEmail', () => {
  it('sends the magic link through the Cloudflare-compatible binding', async () => {
    const send = vi.fn().mockResolvedValue({ messageId: 'message-123' })
    const sender: EmailSender = { send }
    const url = 'https://parrot.garden/api/auth/magic-link/verify?token=secret'

    await sendMagicLinkEmail(sender, 'reader@example.com', url)

    expect(send).toHaveBeenCalledOnce()
    const message = send.mock.calls[0]![0]
    expect(message).toMatchObject({
      from: {
        name: 'parrot.garden',
        email: 'noreply@parrot.garden',
      },
      to: 'reader@example.com',
      subject: 'Sign in to parrot.garden',
    })
    expect(message.html).toContain(url.replaceAll('&', '&amp;'))
    expect(message.text).toContain(url)
  })

  it('propagates Cloudflare send failures', async () => {
    const error = Object.assign(new Error('Rate limit exceeded'), {
      code: 'E_RATE_LIMIT_EXCEEDED',
    })
    const sender: EmailSender = {
      send: vi.fn().mockRejectedValue(error),
    }

    await expect(sendMagicLinkEmail(
      sender,
      'reader@example.com',
      'https://parrot.garden/magic-link',
    )).rejects.toBe(error)
  })
})

describe('getCloudflareEmailSender', () => {
  it('reads the EMAIL binding from Nitro 2 event context', () => {
    const sender: EmailSender = { send: vi.fn() }

    expect(getCloudflareEmailSender({
      context: {
        cloudflare: {
          env: { EMAIL: sender },
        },
      },
    })).toBe(sender)
  })
})

describe('deliverMagicLink', () => {
  it('logs the magic link without sending in development', async () => {
    const send = vi.fn()
    const log = vi.fn()

    await deliverMagicLink({
      email: 'reader@example.com',
      url: 'http://localhost:3000/magic-link',
      isDevelopment: true,
      sender: { send },
      log,
    })

    expect(log).toHaveBeenCalledWith(
      '[Magic Link] Send to reader@example.com: http://localhost:3000/magic-link',
    )
    expect(send).not.toHaveBeenCalled()
  })

  it('fails clearly when the production binding is missing', async () => {
    await expect(deliverMagicLink({
      email: 'reader@example.com',
      url: 'https://parrot.garden/magic-link',
      isDevelopment: false,
    })).rejects.toThrow('Cloudflare EMAIL binding is not configured')
  })
})
