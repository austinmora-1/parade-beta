import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    let code: string | null = null
    let state: string | null = null
    let error: string | null = null
    let callerOrigin: string = ''

    if (req.method === 'POST') {
      // Called from client-side GoogleCallback page
      const body = await req.json()
      code = body.code
      state = body.state
      callerOrigin = req.headers.get('origin') || ''
    } else {
      // Legacy: direct GET redirect from Google (fallback)
      const url = new URL(req.url)
      code = url.searchParams.get('code')
      state = url.searchParams.get('state')
      error = url.searchParams.get('error')
    }

    console.log('Callback received:', { method: req.method, hasCode: !!code, hasState: !!state, error })

    if (error) {
      console.error('OAuth error from Google:', error)
      return new Response(JSON.stringify({ error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!code || !state) {
      return new Response(JSON.stringify({ error: 'Missing authorization code or state' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      return new Response(JSON.stringify({ error: 'Invalid state parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    
    if (!clientId || !clientSecret) {
      console.error('Missing Google credentials')
      return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // The redirect_uri must match what was used in the auth request
    // Use the origin from state (which was set during auth) or the caller's origin
    const appOrigin = origin || callerOrigin || 'https://helloparade.app'
    let cleanOrigin: string
    try {
      cleanOrigin = new URL(appOrigin).origin
    } catch {
      cleanOrigin = 'https://helloparade.app'
    }
    const redirectUri = `${cleanOrigin}/google-callback`
    
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
      return new Response(JSON.stringify({ error: tokens.error_description || tokens.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Store tokens in database using service role
    const supabase = createClient(
      supabaseUrl!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    console.log('Saving connection for user:', userId, 'expires:', expiresAt)

    const { error: upsertError } = await supabase.rpc('upsert_calendar_connection', {
      p_user_id: userId,
      p_provider: 'google',
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token || null,
      p_expires_at: expiresAt,
      p_grant_id: null,
    })

    if (upsertError) {
      console.error('Database upsert error:', upsertError)
      return new Response(JSON.stringify({ error: 'Failed to save connection: ' + upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    // For POST requests (client-side flow), return JSON
    if (req.method === 'POST') {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For GET requests (legacy), redirect
    let appUrl = origin || 'https://helloparade.app'
    try {
      appUrl = new URL(appUrl).origin
    } catch {
      appUrl = 'https://helloparade.app'
    }
    
    return new Response(null, {
      status: 302,
      headers: { 'Location': `${appUrl}/settings?calendar=connected` },
    })
  } catch (error: unknown) {
    console.error('Unhandled error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
