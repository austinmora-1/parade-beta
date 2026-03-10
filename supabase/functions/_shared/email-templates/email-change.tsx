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

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email for Parade</Preview>
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
          <Heading style={h1}>Confirm your new email</Heading>
          <Text style={text}>
            Hey! You asked to change your Parade email from{' '}
            <Link href={`mailto:${email}`} style={link}>
              {email}
            </Link>{' '}
            to{' '}
            <Link href={`mailto:${newEmail}`} style={link}>
              {newEmail}
            </Link>
            . Tap below to confirm:
          </Text>
          <Button style={button} href={confirmationUrl}>
            Confirm Email Change
          </Button>
          <Text style={footerText}>
            If you didn't request this, please secure your account right away.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
const footerText = { fontSize: '12px', color: '#8a9b92', margin: '32px 0 0' }
