import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    console.log('Callback received:', { hasCode: !!code, hasState: !!state, error })

    if (error) {
      console.error('OAuth error from Google:', error)
      return new Response(getErrorHtml(error), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    if (!code || !state) {
      console.error('Missing code or state')
      return new Response(getErrorHtml('Missing authorization code or state'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    let userId: string
    let origin: string = ''
    try {
      const stateData = JSON.parse(atob(state))
      userId = stateData.userId
      origin = stateData.origin || ''
      console.log('Parsed userId:', userId, 'origin:', origin)
    } catch (e) {
      console.error('Failed to parse state:', e)
      return new Response(getErrorHtml('Invalid state parameter'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    
    if (!clientId || !clientSecret) {
      console.error('Missing Google credentials')
      return new Response(getErrorHtml('Google OAuth not configured'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const redirectUri = `${supabaseUrl}/functions/v1/google-calendar-callback`
    console.log('Exchanging code for tokens with redirect:', redirectUri)

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()
    console.log('Token response status:', tokenResponse.status, 'hasAccessToken:', !!tokens.access_token)

    if (tokens.error) {
      console.error('Token error:', tokens)
      return new Response(getErrorHtml(tokens.error_description || tokens.error), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Store tokens in database using service role
    const supabase = createClient(
      supabaseUrl!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    console.log('Saving connection for user:', userId, 'expires:', expiresAt)

    // Upsert directly into calendar_connections table (service role bypasses RLS)
    const { error: upsertError } = await supabase
      .from('calendar_connections')
      .upsert({
        user_id: userId,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt,
      }, { onConflict: 'user_id,provider' })

    if (upsertError) {
      console.error('Database upsert error:', upsertError)
      return new Response(getErrorHtml('Failed to save connection: ' + upsertError.message), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    console.log('Calendar connection saved successfully')

    // Trigger initial sync in the background
    try {
      const syncUrl = `${supabaseUrl}/functions/v1/calendar-sync-worker`
      fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ userId, provider: 'google' }),
      }).then(res => {
        console.log('Initial Google sync triggered, status:', res.status)
      }).catch(err => {
        console.error('Initial Google sync failed:', err)
      })
    } catch (e) {
      console.error('Failed to trigger initial sync:', e)
    }
    
    // Determine the redirect URL - use origin from state, or fallback to published URL
    let appUrl = origin
    if (!appUrl || appUrl === 'null') {
      // Fallback to known app URLs
      appUrl = 'https://parade.lovable.app'
    }
    
    // Clean up the URL - extract just the origin part
    try {
      const parsedUrl = new URL(appUrl)
      appUrl = parsedUrl.origin
    } catch {
      appUrl = 'https://parade.lovable.app'
    }
    
    console.log('Redirecting to:', appUrl)
    
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${appUrl}/settings?calendar=connected` },
    })
  } catch (error: unknown) {
    console.error('Unhandled error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(null, {
      status: 302,
      headers: { 'Location': `https://parade.lovable.app/settings?calendar=error&message=${encodeURIComponent(message)}` },
    })
  }
})

function getSuccessHtml() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connected!</title>
      <style>
        body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0fdf4; }
        .container { text-align: center; padding: 2rem; }
        h1 { color: #16a34a; }
        p { color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✓ Google Calendar Connected!</h1>
        <p>You can close this window and return to the app.</p>
        <script>setTimeout(() => window.close(), 2000);</script>
      </div>
    </body>
    </html>
  `
}

function getErrorHtml(error: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connection Failed</title>
      <style>
        body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #fef2f2; }
        .container { text-align: center; padding: 2rem; max-width: 400px; }
        h1 { color: #dc2626; }
        p { color: #666; word-break: break-word; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✗ Connection Failed</h1>
        <p>${error}</p>
        <p>Please close this window and try again.</p>
      </div>
    </body>
    </html>
  `
}
