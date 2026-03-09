/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join Parade! 🎉</Preview>
    <Body style={main}>
      <Container style={outerContainer}>
        <Section style={header}>
          <Img
            src="https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/email-assets/email-wordmark.png"
            alt="Parade"
            width="140"
            height="auto"
            style={headerLogo}
          />
        </Section>
        <Section style={body}>
          <Heading style={h1}>You're invited! 🎉</Heading>
          <Text style={text}>
            Hey! Someone wants you on{' '}
            <Link href={siteUrl} style={link}>
              <strong>Parade</strong>
            </Link>
            — the easiest way to make plans with friends. Tap below to join the fun!
          </Text>
          <Button style={button} href={confirmationUrl}>
            Accept Invitation
          </Button>
          <Text style={footer}>
            If you weren't expecting this, no worries — just ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const outerContainer = { maxWidth: '480px', margin: '0 auto', overflow: 'hidden' as const }
const header = {
  backgroundColor: '#111E16',
  padding: '32px 25px',
  textAlign: 'center' as const,
}
const headerLogo = { margin: '0 auto' }
const body = { padding: '32px 25px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1a2b22',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#5a6b62',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: '#2d7a4f', textDecoration: 'underline' }
const button = {
  backgroundColor: '#2d7a4f',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '16px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footer = { fontSize: '12px', color: '#8a9b92', margin: '32px 0 0' }
