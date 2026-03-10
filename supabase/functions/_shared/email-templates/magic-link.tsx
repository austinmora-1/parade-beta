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
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Parade login link ✨</Preview>
    <Body style={main}>
      <Section style={headerBanner}>
        <Img
          src="https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/email-assets/email-header-banner.png"
          alt="Parade"
          width="600"
          height="auto"
          style={headerImg}
        />
      </Section>
      <Container style={outerContainer}>
        <Section style={body}>
          <Heading style={h1}>Your login link</Heading>
          <Text style={text}>
            Hey! Tap the button below to hop into Parade. This link expires soon, so don't wait too long!
          </Text>
          <Button style={button} href={confirmationUrl}>
            Log In to Parade
          </Button>
          <Text style={footerText}>
            If you didn't request this link, you can safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const headerBanner = {
  width: '100%',
  textAlign: 'center' as const,
  padding: '0',
  margin: '0',
}
const headerImg = {
  width: '100%',
  maxWidth: '100%',
  display: 'block' as const,
  margin: '0',
}
const outerContainer = { maxWidth: '480px', margin: '0 auto', overflow: 'hidden' as const }
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
const footerText = { fontSize: '12px', color: '#8a9b92', margin: '32px 0 0' }
