import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const icalUrl = body?.icalUrl

    if (!icalUrl || typeof icalUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing icalUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Normalize webcal:// to https://
    let normalizedUrl = icalUrl
    if (normalizedUrl.startsWith('webcal://')) {
      normalizedUrl = normalizedUrl.replace('webcal://', 'https://')
    }

    // Validate the URL looks like an iCal feed
    try {
      new URL(normalizedUrl)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify we can actually fetch the URL
    const testFetch = await fetch(normalizedUrl)
    if (!testFetch.ok) {
      await testFetch.text()
      return new Response(JSON.stringify({ error: 'Could not reach the iCal URL. Make sure it is a public subscription link.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const testContent = await testFetch.text()
    if (!testContent.includes('BEGIN:VCALENDAR')) {
      return new Response(JSON.stringify({ error: 'URL does not appear to be a valid iCal feed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Store the iCal URL in calendar_connections using service role
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // We store the iCal URL in access_token field (it's just a URL, not a secret OAuth token)
    const { error: upsertError } = await adminClient
      .from('calendar_connections')
      .upsert(
        {
          user_id: user.id,
          provider: 'ical',
          access_token: normalizedUrl,
          refresh_token: null,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
          grant_id: null,
        },
        { onConflict: 'user_id,provider' }
      )

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return new Response(JSON.stringify({ error: 'Failed to save connection' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, connected: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
