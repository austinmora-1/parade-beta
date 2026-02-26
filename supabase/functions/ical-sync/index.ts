import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── ICS Parser ──────────────────────────────────────────────────────────────

interface ICalEvent {
  uid: string
  summary: string
  dtstart: Date
  dtend: Date
  isAllDay: boolean
  location?: string
}

function parseICS(icsText: string, rangeStart: Date, rangeEnd: Date): ICalEvent[] {
  const events: ICalEvent[] = []
  const lines = unfoldLines(icsText)

  let inEvent = false
  let uid = ''
  let summary = ''
  let dtstart: Date | null = null
  let dtend: Date | null = null
  let isAllDay = false
  let location = ''

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      uid = ''
      summary = ''
      dtstart = null
      dtend = null
      isAllDay = false
      location = ''
      continue
    }

    if (line === 'END:VEVENT') {
      inEvent = false
      if (dtstart && dtend) {
        // Filter to range
        if (dtend > rangeStart && dtstart < rangeEnd) {
          events.push({ uid, summary, dtstart, dtend, isAllDay, location: location || undefined })
        }
      }
      continue
    }

    if (!inEvent) continue

    if (line.startsWith('UID:')) {
      uid = line.slice(4)
    } else if (line.startsWith('SUMMARY:')) {
      summary = unescapeICS(line.slice(8))
    } else if (line.startsWith('LOCATION:')) {
      location = unescapeICS(line.slice(9))
    } else if (line.startsWith('DTSTART')) {
      const parsed = parseICSDate(line)
      if (parsed) {
        dtstart = parsed.date
        isAllDay = parsed.allDay
      }
    } else if (line.startsWith('DTEND')) {
      const parsed = parseICSDate(line)
      if (parsed) {
        dtend = parsed.date
      }
    }
  }

  return events
}

function unfoldLines(text: string): string[] {
  // ICS spec: lines starting with space/tab are continuations
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n')
}

function unescapeICS(text: string): string {
  return text.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

function parseICSDate(line: string): { date: Date; allDay: boolean } | null {
  // DTSTART;VALUE=DATE:20250301
  // DTSTART;TZID=America/New_York:20250301T090000
  // DTSTART:20250301T090000Z
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null

  const params = line.slice(0, colonIdx)
  const value = line.slice(colonIdx + 1).trim()

  const allDay = params.includes('VALUE=DATE') && !params.includes('VALUE=DATE-TIME')

  if (allDay) {
    // YYYYMMDD
    const y = parseInt(value.slice(0, 4))
    const m = parseInt(value.slice(4, 6)) - 1
    const d = parseInt(value.slice(6, 8))
    return { date: new Date(Date.UTC(y, m, d)), allDay: true }
  }

  // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const y = parseInt(value.slice(0, 4))
  const m = parseInt(value.slice(4, 6)) - 1
  const d = parseInt(value.slice(6, 8))
  const h = parseInt(value.slice(9, 11))
  const min = parseInt(value.slice(11, 13))
  const s = parseInt(value.slice(13, 15)) || 0

  if (value.endsWith('Z')) {
    return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false }
  }

  // Extract TZID (e.g. DTSTART;TZID=America/New_York:20260226T073000)
  const tzidMatch = params.match(/TZID=([^;:]+)/)
  const tzid = tzidMatch ? tzidMatch[1] : undefined

  if (tzid) {
    // The parsed h/min/s are LOCAL to the TZID timezone.
    // Convert to proper UTC using Intl offset computation.
    try {
      // Create a "guess" Date using the local components as if they were UTC
      const guess = new Date(Date.UTC(y, m, d, h, min, s))
      // Format that guess in the target timezone to see what local time it maps to
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tzid,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      })
      const parts = formatter.formatToParts(guess)
      const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')
      const tzHour = getPart('hour') === 24 ? 0 : getPart('hour')

      // Build a Date from the timezone-local representation of our guess
      const localAsUtc = new Date(Date.UTC(
        getPart('year'), getPart('month') - 1, getPart('day'),
        tzHour, getPart('minute'), getPart('second')
      ))

      // offset = what-UTC-looks-like-in-TZ minus actual-UTC
      const offsetMs = localAsUtc.getTime() - guess.getTime()
      // Correct: the real UTC = guess(local-components-as-UTC) - offset
      const correctedUtc = new Date(guess.getTime() - offsetMs)

      return { date: correctedUtc, allDay: false }
    } catch {
      // If TZID is unrecognized, fall back to treating as UTC
      return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false }
    }
  }

  // No timezone info — treat as UTC
  return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false }
}

// ── Time Slot Helpers (mirrored from google-calendar-sync) ──────────────────

function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 9) return 'early_morning'
  if (hour >= 9 && hour < 12) return 'late_morning'
  if (hour >= 12 && hour < 15) return 'early_afternoon'
  if (hour >= 15 && hour < 18) return 'late_afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'late_night'
}

function getHourInTimezone(date: Date, timezone?: string): number {
  if (timezone) {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(date), 10)
  }
  return date.getUTCHours()
}

function getDateString(date: Date, timezone?: string): string {
  if (timezone) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  }
  return date.toISOString().split('T')[0]
}

function getEventTimeSlots(startTime: Date, endTime: Date, timezone?: string): string[] {
  const slots = new Set<string>()
  const current = new Date(startTime)
  while (current < endTime) {
    const hour = getHourInTimezone(current, timezone)
    slots.add(getTimeSlot(hour))
    current.setTime(current.getTime() + 60 * 60 * 1000)
  }
  return Array.from(slots)
}

function getEventDates(startTime: Date, endTime: Date, timezone?: string): string[] {
  const dates: string[] = []
  const seen = new Set<string>()
  const current = new Date(startTime)
  while (current <= endTime) {
    const d = getDateString(current, timezone)
    if (!seen.has(d)) {
      seen.add(d)
      dates.push(d)
    }
    current.setTime(current.getTime() + 60 * 60 * 1000)
  }
  return dates
}

// Format a Date to HH:MM in the given timezone
function formatTimeHHMM(date: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
  if (timezone) opts.timeZone = timezone
  return new Intl.DateTimeFormat('en-GB', opts).format(date)
}

// ── Activity Classifier (same as gcal sync) ─────────────────────────────────

function classifyActivity(summary?: string): string {
  if (!summary) return 'events'
  const s = summary.toLowerCase()

  if (/\bflight\b/.test(s)) return 'flight'
  if (/\b(workout|gym|fitness|yoga|pilates|crossfit|run|running|swim|cycling|bike|hike|basketball|soccer|football|tennis|climbing|boxing|training|exercise)\b/.test(s)) return 'workout-out'
  if (/\b(dinner|lunch|brunch|breakfast|restaurant|eat|food)\b/.test(s)) return 'getting-food'
  if (/\b(drinks|happy hour|bar|cocktail|beer|wine|pub|brewery)\b/.test(s)) return 'drinks'
  if (/\b(coffee|cafe|café|tea)\b/.test(s)) return 'coffee'
  if (/\b(movie|cinema|film|concert|show|theater|theatre)\b/.test(s)) return 'movies'
  if (/\b(doctor|dentist|appointment|therapy|therapist)\b/.test(s)) return 'doctor'
  if (/\b(errand|bank|pickup|drop off)\b/.test(s)) return 'errands'
  if (/\b(shop|shopping|grocery|groceries)\b/.test(s)) return 'shopping'

  return 'events'
}

// ── Main Handler ────────────────────────────────────────────────────────────

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

    const userId = user.id

    let timezone: string | undefined
    try {
      const body = await req.json()
      timezone = body?.timezone
    } catch { /* no body */ }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get the iCal URL from calendar_connections
    const { data: connRows, error: connError } = await adminClient
      .from('calendar_connections')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', 'ical')

    if (connError || !connRows || connRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Apple Calendar not connected', connected: false, synced: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const icalUrl = connRows[0].access_token
    if (!icalUrl) {
      return new Response(
        JSON.stringify({ error: 'No iCal URL stored', connected: false, synced: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the ICS feed
    const icsResponse = await fetch(icalUrl)
    if (!icsResponse.ok) {
      const errorText = await icsResponse.text()
      console.error('iCal fetch error:', icsResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch iCal feed. The URL may have expired.', connected: true, synced: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const icsText = await icsResponse.text()
    if (!icsText.includes('BEGIN:VCALENDAR')) {
      return new Response(
        JSON.stringify({ error: 'Invalid iCal data', connected: true, synced: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse events for ±3 months
    const now = new Date()
    const rangeStart = new Date(now)
    rangeStart.setMonth(rangeStart.getMonth() - 3)
    const rangeEnd = new Date(now)
    rangeEnd.setMonth(rangeEnd.getMonth() + 3)

    const events = parseICS(icsText, rangeStart, rangeEnd)

    // ── Update availability ────────────────────────────────────────────────

    const busySlotsByDate: Map<string, Set<string>> = new Map()

    for (const event of events) {
      if (event.isAllDay) {
        const endExclusive = new Date(event.dtend)
        endExclusive.setDate(endExclusive.getDate() - 1)
        const dates = getEventDates(event.dtstart, endExclusive, timezone)
        for (const date of dates) {
          if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
          ;['early_morning', 'late_morning', 'early_afternoon', 'late_afternoon', 'evening', 'late_night'].forEach(
            slot => busySlotsByDate.get(date)!.add(slot)
          )
        }
        continue
      }

      const dates = getEventDates(event.dtstart, event.dtend, timezone)
      for (const date of dates) {
        if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
        const slots = getEventTimeSlots(event.dtstart, event.dtend, timezone)
        slots.forEach(slot => busySlotsByDate.get(date)!.add(slot))
      }
    }

    let updatedCount = 0
    for (const [date, slots] of busySlotsByDate) {
      const slotUpdates: Record<string, boolean> = {}
      for (const slot of slots) slotUpdates[slot] = false

      const { error: upsertError } = await adminClient
        .from('availability')
        .upsert(
          { user_id: userId, date, ...slotUpdates },
          { onConflict: 'user_id,date', ignoreDuplicates: false }
        )

      if (upsertError) {
        console.error('Error upserting availability for', date, ':', upsertError)
      } else {
        updatedCount++
      }
    }

    // ── Create plans ───────────────────────────────────────────────────────

    // Delete old iCal-sourced plans
    await adminClient
      .from('plans')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'ical')

    const planRows = []
    for (const event of events) {
      const hour = event.isAllDay ? 8 : getHourInTimezone(event.dtstart, timezone)
      const timeSlot = getTimeSlot(hour).replace('_', '-')

      // Always store noon UTC of the local calendar day to prevent timezone day-shift
      const localDateStr = getDateString(event.dtstart, timezone)
      const planDate = `${localDateStr}T12:00:00+00:00`

      // Extract start/end times for timed events
      const startTimeStr = event.isAllDay ? null : formatTimeHHMM(event.dtstart, timezone)
      const endTimeStr = event.isAllDay ? null : formatTimeHHMM(event.dtend, timezone)

      planRows.push({
        user_id: userId,
        title: event.summary || 'iCal imported event',
        activity: classifyActivity(event.summary),
        date: planDate,
        time_slot: timeSlot,
        duration: 1,
        location: event.location || null,
        source: 'ical',
        source_event_id: event.uid,
        start_time: startTimeStr,
        end_time: endTimeStr,
      })
    }

    if (planRows.length > 0) {
      const { error: plansError } = await adminClient
        .from('plans')
        .insert(planRows)

      if (plansError) {
        console.error('Error inserting iCal plans:', plansError)
      }
    }

    return new Response(
      JSON.stringify({
        connected: true,
        synced: true,
        eventsProcessed: events.length,
        datesUpdated: updatedCount,
        message: `Synced ${events.length} events, updated ${updatedCount} days`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
