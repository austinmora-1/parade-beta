import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map time to Parade time slots
function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 9) return 'early_morning'
  if (hour >= 9 && hour < 12) return 'late_morning'
  if (hour >= 12 && hour < 15) return 'early_afternoon'
  if (hour >= 15 && hour < 18) return 'late_afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'late_night' // 22-6
}

// Get all time slots that an event spans
function getEventTimeSlots(startTime: Date, endTime: Date): string[] {
  const slots = new Set<string>()

  // Iterate through each hour the event covers
  const current = new Date(startTime)
  while (current < endTime) {
    const hour = current.getHours()
    slots.add(getTimeSlot(hour))
    current.setHours(current.getHours() + 1)
  }

  return Array.from(slots)
}

// Get date string in YYYY-MM-DD format
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Get all dates that an event spans
function getEventDates(startTime: Date, endTime: Date): string[] {
  const dates: string[] = []
  const current = new Date(startTime)
  current.setHours(0, 0, 0, 0)

  const endDate = new Date(endTime)
  endDate.setHours(0, 0, 0, 0)

  while (current <= endDate) {
    dates.push(getDateString(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

interface CalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

async function handleEventsSync(params: {
  adminClient: any
  userId: string
  events: CalendarEvent[]
}) {
  const { adminClient, userId, events } = params

  // Build a map of date -> slots to mark as busy
  const busySlotsByDate: Map<string, Set<string>> = new Map()

  for (const event of events) {
    // All-day events (they don't have dateTime)
    if (!event.start.dateTime || !event.end.dateTime) {
      if (event.start.date && event.end.date) {
        const startDate = new Date(event.start.date)
        const endDate = new Date(event.end.date)
        endDate.setDate(endDate.getDate() - 1) // All-day end is exclusive

        const dates = getEventDates(startDate, endDate)
        for (const date of dates) {
          if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
          ;['early_morning', 'late_morning', 'early_afternoon', 'late_afternoon', 'evening', 'late_night'].forEach(
            (slot) => busySlotsByDate.get(date)!.add(slot)
          )
        }
      }
      continue
    }

    const startTime = new Date(event.start.dateTime)
    const endTime = new Date(event.end.dateTime)

    const dates = getEventDates(startTime, endTime)

    for (const date of dates) {
      if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())

      const dayStart = new Date(date)
      const dayEnd = new Date(date)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const effectiveStart = startTime < dayStart ? dayStart : startTime
      const effectiveEnd = endTime > dayEnd ? dayEnd : endTime

      const slots = getEventTimeSlots(effectiveStart, effectiveEnd)
      slots.forEach((slot) => busySlotsByDate.get(date)!.add(slot))
    }
  }

  // Update availability table for each date with busy slots
  let updatedCount = 0
  for (const [date, slots] of busySlotsByDate) {
    const slotUpdates: Record<string, boolean> = {}
    for (const slot of slots) slotUpdates[slot] = false

    const { error: upsertError } = await adminClient
      .from('availability')
      .upsert(
        {
          user_id: userId,
          date,
          ...slotUpdates,
        },
        {
          onConflict: 'user_id,date',
          ignoreDuplicates: false,
        }
      )

    if (upsertError) {
      console.error('Error upserting availability for', date, ':', upsertError)
    } else {
      updatedCount++
    }
  }

  // Create plans for each imported event
  // First, delete old gcal-imported plans so we don't duplicate
  await adminClient
    .from('plans')
    .delete()
    .eq('user_id', userId)
    .eq('source', 'gcal')

  // Map each calendar event to a plan row
  const planRows = []
  for (const event of events) {
    const startDate = event.start.dateTime
      ? new Date(event.start.dateTime)
      : event.start.date
        ? new Date(event.start.date)
        : null
    if (!startDate) continue

    const dateStr = getDateString(startDate)
    const hour = event.start.dateTime ? startDate.getHours() : 8
    const timeSlot = getTimeSlot(hour)
    // Map underscore-based slot names to hyphenated Plan TimeSlot format
    const timeSlotHyphen = timeSlot.replace('_', '-')

    planRows.push({
      user_id: userId,
      title: event.summary || 'Gcal imported event',
      activity: 'events',
      date: dateStr,
      time_slot: timeSlotHyphen,
      duration: 1,
      source: 'gcal',
      source_event_id: event.id,
    })
  }

  if (planRows.length > 0) {
    const { error: plansError } = await adminClient
      .from('plans')
      .insert(planRows)

    if (plansError) {
      console.error('Error inserting gcal plans:', plansError)
    }
  }

  return { updatedCount }
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

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    // Validate user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id

    // Service role client to read tokens + update availability
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: connRows, error: connError } = await adminClient
      .from('calendar_connections')
      .select('access_token, refresh_token, expires_at, grant_id')
      .eq('user_id', userId)
      .eq('provider', 'google')

    if (connError || !connRows || connRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected', connected: false, synced: false }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const tokenData = connRows[0]

    let accessToken = tokenData.access_token

    // Refresh if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      const refreshedToken = await refreshAccessToken(tokenData.refresh_token, adminClient, userId)
      if (!refreshedToken) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token', connected: false, synced: false }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      accessToken = refreshedToken
    }

    // Fetch calendar events for the next 30 days
    const now = new Date()
    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    calendarUrl.searchParams.set('timeMin', timeMin)
    calendarUrl.searchParams.set('timeMax', timeMax)
    calendarUrl.searchParams.set('maxResults', '250')
    calendarUrl.searchParams.set('singleEvents', 'true')
    calendarUrl.searchParams.set('orderBy', 'startTime')

    const calendarResponse = await fetch(calendarUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text()
      console.error('Calendar API error:', calendarResponse.status, errorText)

      // Most common user-facing failure: 403 from Google (API disabled or permission revoked)
      if (calendarResponse.status === 401 || calendarResponse.status === 403) {
        return new Response(
          JSON.stringify({
            error:
              'Google denied access (403). Please disconnect + reconnect Google Calendar. If this persists, ensure the Google Calendar API is enabled for the OAuth client used by Parade.',
            connected: true,
            synced: false,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response(JSON.stringify({ error: 'Failed to fetch events', connected: true, synced: false }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const calendarData = await calendarResponse.json()
    const events: CalendarEvent[] = calendarData.items || []

    const { updatedCount } = await handleEventsSync({ adminClient, userId, events })

    return new Response(
      JSON.stringify({
        connected: true,
        synced: true,
        eventsProcessed: events.length,
        datesUpdated: updatedCount,
        message: `Synced ${events.length} events, updated ${updatedCount} days`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message, synced: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function refreshAccessToken(refreshToken: string, supabase: any, userId: string): Promise<string | null> {
  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    const tokens = await response.json()

    if (tokens.error) {
      console.error('Token refresh error:', tokens)
      return null
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    await supabase
      .from('calendar_connections')
      .update({ access_token: tokens.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider', 'google')

    return tokens.access_token
  } catch (error) {
    console.error('Refresh token error:', error)
    return null
  }
}
