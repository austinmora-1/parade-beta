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
    // This function is called by cron — authenticate via Authorization header (anon key from cron)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Get all users with calendar connections
    const { data: connections, error: connError } = await adminClient
      .from('calendar_connections')
      .select('user_id, provider')

    if (connError) {
      console.error('Error fetching connections:', connError)
      return new Response(JSON.stringify({ error: 'Failed to fetch connections' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: 'No calendar connections to sync', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${connections.length} calendar connections to sync`)

    let successCount = 0
    let errorCount = 0

    for (const conn of connections) {
      try {
        const functionName = conn.provider === 'google'
          ? 'google-calendar-sync'
          : conn.provider === 'ical'
            ? 'ical-sync'
            : null

        if (!functionName) {
          console.log(`Skipping unknown provider: ${conn.provider}`)
          continue
        }

        // For user-authenticated sync functions, we need to impersonate the user.
        // We'll call the sync logic directly via internal HTTP with a service role approach.
        // The sync functions require a Bearer token — we'll generate a short-lived token for the user.
        
        // Get the user's session by creating an admin auth link
        // Instead, call the function URL directly with service role key and pass user_id in body
        const syncUrl = `${supabaseUrl}/functions/v1/calendar-sync-worker`
        
        const response = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            userId: conn.user_id,
            provider: conn.provider,
          }),
        })

        if (response.ok) {
          const result = await response.json()
          console.log(`Synced ${conn.provider} for user ${conn.user_id}:`, result.message || 'OK')
          successCount++
        } else {
          const errorText = await response.text()
          console.error(`Failed to sync ${conn.provider} for user ${conn.user_id}:`, errorText)
          errorCount++
        }
      } catch (err) {
        console.error(`Error syncing ${conn.provider} for user ${conn.user_id}:`, err)
        errorCount++
      }
    }

    return new Response(
      JSON.stringify({
        message: `Cron sync complete. ${successCount} succeeded, ${errorCount} failed.`,
        synced: successCount,
        errors: errorCount,
        total: connections.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Cron sync error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
