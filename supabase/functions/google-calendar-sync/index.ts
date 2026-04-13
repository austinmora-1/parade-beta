import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getTimeSlot, getHourInTimezone, getDateString, getEventTimeSlots, getEventDates,
  formatTimeHHMM, getDateRange, AIRPORT_CITY_MAP,
  resolveToCity, extractFlightDestination, isFlightEvent,
  isCityMatchingHome, isLocationMatch, isDateAfterReturn,
  isHotelEvent, extractHotelLocation,
  normalizePlanTitle, makeContentKey,
  classifyActivity, reconcilePlans, fetchAllGoogleEvents,
  type CalendarEvent, type FlightInfo, type HotelStay, type PendingReturnTrip,
} from '../_shared/calendar-helpers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GCalEvent extends CalendarEvent {}

async function handleEventsSync(params: {
  adminClient: any
  userId: string
  events: GCalEvent[]
  timezone?: string
}): Promise<{ updatedCount: number; pendingReturnTrips: PendingReturnTrip[] }> {
  const { adminClient, userId, events, timezone } = params

  const { data: profileData } = await adminClient
    .from('profiles')
    .select('home_address')
    .eq('user_id', userId)
    .single()
  const homeAddress: string | null = profileData?.home_address || null

  const busySlotsByDate: Map<string, Set<string>> = new Map()
  const allFlights: FlightInfo[] = []
  const hotelStays: HotelStay[] = []

  for (const event of events) {
    if (!event.start.dateTime || !event.end.dateTime) {
      if (event.start.date && event.end.date) {
        const startDate = new Date(event.start.date)
        const endDate = new Date(event.end.date)
        endDate.setDate(endDate.getDate() - 1)
        const dates = getEventDates(startDate, endDate, timezone)
        for (const date of dates) {
          if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
          ;['early_morning', 'late_morning', 'early_afternoon', 'late_afternoon', 'evening', 'late_night'].forEach(
            (slot) => busySlotsByDate.get(date)!.add(slot)
          )
        }
        if (isHotelEvent(event.summary, event.location)) {
          const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
          if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
            const endExcl = new Date(event.end.date); endExcl.setDate(endExcl.getDate() - 1)
            hotelStays.push({ startDate: getDateString(startDate, timezone), endDate: getDateString(endExcl, timezone), city: hotelCity })
          }
        }
      }
      continue
    }

    const startTime = new Date(event.start.dateTime)
    const endTime = new Date(event.end.dateTime)
    const dates = getEventDates(startTime, endTime, timezone)
    for (const date of dates) {
      if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
      const slots = getEventTimeSlots(startTime, endTime, timezone)
      slots.forEach((slot) => busySlotsByDate.get(date)!.add(slot))
    }

    if (isFlightEvent(event)) {
      const city = resolveToCity(extractFlightDestination(event.summary))
      const isReturn = city ? isCityMatchingHome(city, homeAddress) : false
      const rawDateTime = event.start.dateTime || event.start.date || null
      const sd = rawDateTime ? new Date(rawDateTime) : null
      if (!sd || isNaN(sd.getTime())) continue
      const dateStr = getDateString(sd, timezone)
      const ts = sd.getTime()
      console.log(`[FLIGHT] "${event.summary}" | raw=${rawDateTime} | parsed=${sd.toISOString()} | ts=${ts} | dateStr=${dateStr} | city=${city} | isReturn=${isReturn}`)
      allFlights.push({ date: dateStr, timestamp: ts, city, isReturn })
      continue
    }

    if (isHotelEvent(event.summary, event.location)) {
      const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
      if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
        hotelStays.push({
          startDate: getDateString(startTime, timezone),
          endDate: getDateString(endTime, timezone),
          city: hotelCity,
        })
      }
    }
  }

  allFlights.sort((a, b) => a.timestamp - b.timestamp)
  console.log(`[FLIGHTS SORTED] ${allFlights.map(f => `${f.city}@${f.date}(ts=${f.timestamp})`).join(' → ')}`)

  const flightLocationByDate: Map<string, string> = new Map()
  for (const flight of allFlights) {
    if (flight.city && !flight.isReturn) {
      flightLocationByDate.set(flight.date, flight.city)
    }
  }
  console.log(`[FLIGHT LOCATIONS BY DATE] ${JSON.stringify(Object.fromEntries(flightLocationByDate))}`)

  const allFlightDatesSet = new Set(allFlights.map(f => f.date))

  const { data: existingTrips } = await adminClient
    .from('trips')
    .select('id, location, start_date, end_date, needs_return_date')
    .eq('user_id', userId)

  const returnHomeDates = new Set<string>()
  const outboundFlightDates = new Set<string>()
  const flightsByDate = new Map<string, FlightInfo[]>()
  for (const f of allFlights) {
    if (!flightsByDate.has(f.date)) flightsByDate.set(f.date, [])
    flightsByDate.get(f.date)!.push(f)
  }
  for (const [date, flights] of flightsByDate) {
    const lastFlight = flights[flights.length - 1]
    if (lastFlight.isReturn) {
      returnHomeDates.add(date)
      flightLocationByDate.delete(date)
    } else if (lastFlight.city) {
      outboundFlightDates.add(date)
    }
  }

  const pendingReturnTrips: PendingReturnTrip[] = []
  const outboundEntries = Array.from(flightLocationByDate.entries()).sort(([a], [b]) => a.localeCompare(b))

  for (const [outDate, city] of outboundEntries) {
    const resolvedTrip = (existingTrips || []).find((trip: any) =>
      !trip.needs_return_date &&
      isLocationMatch(trip.location, city) &&
      trip.start_date <= outDate &&
      trip.end_date >= outDate
    )

    if (resolvedTrip) {
      const current = new Date(outDate + 'T00:00:00Z')
      current.setDate(current.getDate() + 1)
      const manualEnd = new Date(resolvedTrip.end_date + 'T00:00:00Z')
      while (current <= manualEnd) {
        const dateStr = current.toISOString().split('T')[0]
        if (allFlightDatesSet.has(dateStr)) break
        flightLocationByDate.set(dateStr, city)
        current.setDate(current.getDate() + 1)
      }
      continue
    }

    let hasReturn = false
    const outDateObj = new Date(outDate + 'T00:00:00Z')
    const maxReturnDate = new Date(outDateObj)
    maxReturnDate.setDate(maxReturnDate.getDate() + 30)
    const maxReturnStr = maxReturnDate.toISOString().split('T')[0]

    for (const rf of allFlights) {
      if (rf.date > outDate && rf.date <= maxReturnStr && rf.isReturn) { hasReturn = true; break }
      if (rf.date > outDate && rf.date <= maxReturnStr && !rf.isReturn && rf.city && rf.city !== city) { hasReturn = true; break }
    }

    if (hasReturn) {
      const current = new Date(outDate)
      current.setDate(current.getDate() + 1)
      for (let i = 0; i < 30; i++) {
        const dateStr = current.toISOString().split('T')[0]
        if (allFlightDatesSet.has(dateStr)) break
        flightLocationByDate.set(dateStr, city)
        current.setDate(current.getDate() + 1)
      }
    } else {
      const current = new Date(outDate)
      current.setDate(current.getDate() + 1)
      for (let i = 0; i < 7; i++) {
        const dateStr = current.toISOString().split('T')[0]
        if (allFlightDatesSet.has(dateStr)) break
        flightLocationByDate.set(dateStr, city)
        current.setDate(current.getDate() + 1)
      }
      pendingReturnTrips.push({ destination: city, departureDate: outDate })
    }
  }

  // Apply hotel stays (flight dates take priority)
  const hotelLocationByDate: Map<string, string> = new Map()
  for (const stay of hotelStays) {
    const dates = getDateRange(stay.startDate, stay.endDate)
    for (const d of dates) {
      if (!flightLocationByDate.has(d)) hotelLocationByDate.set(d, stay.city)
    }
  }

  const allLocationByDate = new Map(flightLocationByDate)
  for (const [d, city] of hotelLocationByDate) {
    if (!allLocationByDate.has(d)) allLocationByDate.set(d, city)
  }

  const now = new Date()
  const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeMonthsAhead = new Date(now); threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3)

  const syncRangeStart = getDateString(threeMonthsAgo, timezone)
  const syncRangeEnd = getDateString(threeMonthsAhead, timezone)
  const { data: existingAvailabilityRows } = await adminClient
    .from('availability')
    .select('date, location_status, trip_location')
    .eq('user_id', userId)
    .gte('date', syncRangeStart)
    .lte('date', syncRangeEnd)

  const existingAvailabilityByDate = new Map(
    (existingAvailabilityRows || []).map((row: { date: string; location_status: string | null; trip_location: string | null }) => [row.date, row])
  )

  let updatedCount = 0
  for (const [date, slots] of busySlotsByDate) {
    const slotUpdates: Record<string, boolean> = {}
    for (const slot of slots) slotUpdates[slot] = false

    const locationCity = allLocationByDate.get(date)
    const existingRow = existingAvailabilityByDate.get(date)
    const isReturnDate = returnHomeDates.has(date)
    const shouldClearStaleHomeAway = !locationCity && !!existingRow?.trip_location && isCityMatchingHome(existingRow.trip_location, homeAddress)
    const shouldClearAfterReturn = !locationCity && !isReturnDate && !!existingRow?.trip_location && !isCityMatchingHome(existingRow.trip_location, homeAddress) && isDateAfterReturn(date, returnHomeDates, outboundFlightDates)
    const locationFields: Record<string, string | null> = {}
    if (locationCity) {
      locationFields.location_status = 'away'
      locationFields.trip_location = locationCity
    } else if (isReturnDate || shouldClearStaleHomeAway || shouldClearAfterReturn) {
      locationFields.location_status = 'home'
      locationFields.trip_location = null
    }

    const { error: upsertError } = await adminClient
      .from('availability')
      .upsert({ user_id: userId, date, ...slotUpdates, ...locationFields }, { onConflict: 'user_id,date', ignoreDuplicates: false })

    if (upsertError) console.error('Error upserting availability for', date, ':', upsertError)
    else updatedCount++
  }

  for (const [date, city] of allLocationByDate) {
    if (busySlotsByDate.has(date)) continue
    const { error } = await adminClient
      .from('availability')
      .upsert({ user_id: userId, date, location_status: 'away', trip_location: city }, { onConflict: 'user_id,date', ignoreDuplicates: false })
    if (error) console.error('Error upserting location for', date, ':', error)
    else updatedCount++
  }

  for (const existingRow of (existingAvailabilityRows || [])) {
    if (busySlotsByDate.has(existingRow.date) || allLocationByDate.has(existingRow.date)) continue
    const isReturnDate = returnHomeDates.has(existingRow.date)
    const shouldClear = isReturnDate ||
      (existingRow.trip_location && isCityMatchingHome(existingRow.trip_location, homeAddress)) ||
      (existingRow.trip_location && !isCityMatchingHome(existingRow.trip_location, homeAddress) && isDateAfterReturn(existingRow.date, returnHomeDates, outboundFlightDates))
    if (shouldClear) {
      const { error } = await adminClient
        .from('availability')
        .upsert({ user_id: userId, date: existingRow.date, location_status: 'home', trip_location: null }, { onConflict: 'user_id,date', ignoreDuplicates: false })
      if (error) console.error('Error clearing stale location for', existingRow.date, ':', error)
    }
  }

  await adminClient.rpc('merge_overlapping_trips', { p_user_id: userId })

  if (pendingReturnTrips.length > 0) {
    for (const pending of pendingReturnTrips) {
      const { data: existingTrips } = await adminClient
        .from('trips')
        .select('id, needs_return_date')
        .eq('user_id', userId)
        .eq('start_date', pending.departureDate)
        .ilike('location', `%${pending.destination}%`)

      if (existingTrips && existingTrips.length > 0) {
        await adminClient.from('trips').update({ needs_return_date: true }).eq('id', existingTrips[0].id)
      }
    }

    for (const pending of pendingReturnTrips) {
      const { data: trips } = await adminClient
        .from('trips')
        .select('id')
        .eq('user_id', userId)
        .lte('start_date', pending.departureDate)
        .gte('end_date', pending.departureDate)
        .ilike('location', `%${pending.destination}%`)

      if (trips && trips.length > 0) {
        await adminClient.from('trips').update({ needs_return_date: true }).eq('id', trips[0].id)
      }
    }
  }

  // ── Sync plans using shared reconciliation ──
  const incomingEventIds = new Set<string>()
  const planRowsByEventId = new Map<string, any>()

  for (const event of events) {
    const startDate = event.start.dateTime
      ? new Date(event.start.dateTime)
      : event.start.date
        ? new Date(event.start.date)
        : null
    if (!startDate) continue

    const hour = event.start.dateTime ? getHourInTimezone(startDate, timezone) : 8
    const timeSlotHyphen = getTimeSlot(hour).replace('_', '-')
    const localDateStr = getDateString(startDate!, timezone)
    const planDate = `${localDateStr}T12:00:00+00:00`
    const startTimeStr = event.start.dateTime ? formatTimeHHMM(new Date(event.start.dateTime), timezone) : null
    const endTimeStr = event.end.dateTime ? formatTimeHHMM(new Date(event.end.dateTime), timezone) : null

    incomingEventIds.add(event.id)
    planRowsByEventId.set(event.id, {
      user_id: userId,
      title: event.summary || 'Gcal imported event',
      activity: classifyActivity(event.summary, isFlightEvent(event)),
      date: planDate,
      time_slot: timeSlotHyphen,
      duration: 1,
      source: 'gcal',
      source_event_id: event.id,
      start_time: startTimeStr,
      end_time: endTimeStr,
    })
  }

  await reconcilePlans({ adminClient, userId, source: 'gcal', planRowsByEventId, incomingEventIds })

  return { updatedCount, pendingReturnTrips }
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

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
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
    } catch { /* no body or invalid JSON */ }

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: connRows, error: connError } = await adminClient
      .from('calendar_connections')
      .select('access_token, refresh_token, expires_at, grant_id')
      .eq('user_id', userId)
      .eq('provider', 'google')

    if (connError || !connRows || connRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected', connected: false, synced: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokenData = connRows[0]
    let accessToken = tokenData.access_token

    if (new Date(tokenData.expires_at) < new Date()) {
      const refreshedToken = await refreshAccessToken(tokenData.refresh_token, adminClient, userId)
      if (!refreshedToken) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token', connected: false, synced: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      accessToken = refreshedToken
    }

    const now = new Date()
    const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const threeMonthsAhead = new Date(now); threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3)

    let events: CalendarEvent[]
    try {
      events = await fetchAllGoogleEvents(
        accessToken,
        threeMonthsAgo.toISOString(),
        threeMonthsAhead.toISOString(),
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Calendar API error:', message)

      if (message.includes('401') || message.includes('403')) {
        return new Response(
          JSON.stringify({
            error: 'Google denied access (403). Please disconnect + reconnect Google Calendar.',
            connected: true, synced: false,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ error: 'Failed to fetch events', connected: true, synced: false }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { updatedCount, pendingReturnTrips } = await handleEventsSync({ adminClient, userId, events, timezone })

    return new Response(
      JSON.stringify({
        connected: true, synced: true,
        eventsProcessed: events.length, datesUpdated: updatedCount,
        pendingReturnTrips,
        message: `Synced ${events.length} events, updated ${updatedCount} days`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message, synced: false }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }),
    })

    const tokens = await response.json()
    if (tokens.error) { console.error('Token refresh error:', tokens); return null }

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
