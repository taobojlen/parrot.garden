import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import React from 'react'

const e = React.createElement

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container: React.CSSProperties = {
  margin: '40px auto',
  padding: '32px',
  maxWidth: '480px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
}

const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#18181b',
  margin: '0 0 24px',
}

const section: React.CSSProperties = {
  marginBottom: '24px',
}

const text: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#3f3f46',
  margin: '0 0 20px',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#18181b',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '500',
  textDecoration: 'none',
  padding: '10px 24px',
  borderRadius: '6px',
}

const footer: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '20px',
  color: '#a1a1aa',
  margin: '0',
}

export default function MagicLinkEmail({ url }: { url: string }) {
  return e(Html, null,
    e(Head),
    e(Preview, null, 'Sign in to parrot.garden'),
    e(Body, { style: body },
      e(Container, { style: container },
        e(Heading, { style: heading }, 'Sign in to parrot.garden'),
        e(Section, { style: section },
          e(Text, { style: text },
            'Click the button below to sign in. This link expires in 5 minutes.',
          ),
          e(Link, { href: url, style: button }, 'Sign in'),
        ),
        e(Text, { style: footer },
          "If you didn't request this email, you can safely ignore it.",
        ),
      ),
    ),
  )
}
