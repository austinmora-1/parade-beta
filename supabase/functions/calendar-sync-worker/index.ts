import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getTimeSlot, getHourInTimezone, getDateString, getEventTimeSlots, getEventDates,
  formatTimeHHMM, getDateRange, parseAllDayDate, getAllDayDateRange,
  resolveToCity, extractFlightDestination, isFlightEvent,
  isCityMatchingHome, isLocationMatch, isDateAfterReturn,
  isHotelEvent, extractHotelLocation,
  classifyActivity, parseICS, reconcilePlans, fetchAllGoogleEvents,
  type ICalEvent, type FlightInfo, type HotelStay, type PendingReturnTrip,
  type CalendarEvent,
} from '../_shared/calendar-helpers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GCalEvent extends CalendarEvent {}

async function syncGoogleCalendar(adminClient: any, userId: string): Promise<{ eventsProcessed: number; datesUpdated: number }> {
  const { data: connRows, error: connError } = await adminClient
    .from('calendar_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')

  if (connError || !connRows || connRows.length === 0) throw new Error('Google Calendar not connected')

  const { data: profileData } = await adminClient
    .from('profiles')
    .select('home_address, timezone')
    .eq('user_id', userId)
    .single()
  const homeAddress: string | null = profileData?.home_address || null
  const timezone: string | undefined = profileData?.timezone || undefined

  let accessToken = connRows[0].access_token

  // Refresh if expired
  if (new Date(connRows[0].expires_at) < new Date()) {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: connRows[0].refresh_token, grant_type: 'refresh_token',
      }),
    })
    const tokens = await response.json()
    if (tokens.error) throw new Error('Failed to refresh Google token')
    accessToken = tokens.access_token
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    await adminClient.from('calendar_connections').update({ access_token: accessToken, expires_at: expiresAt, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('provider', 'google')
  }

  const now = new Date()
  const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeMonthsAhead = new Date(now); threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3)

  const events: GCalEvent[] = await fetchAllGoogleEvents(
    accessToken,
    threeMonthsAgo.toISOString(),
    threeMonthsAhead.toISOString(),
  )

  // Process events into availability
  const busySlotsByDate: Map<string, Set<string>> = new Map()
  const allFlights: FlightInfo[] = []
  const hotelStays: HotelStay[] = []

  for (const event of events) {
    if (!event.start.dateTime || !event.end.dateTime) {
      if (event.start.date && event.end.date) {
        // Parse all-day date strings directly to avoid timezone shift
        const startParsed = parseAllDayDate(event.start.date)
        const endDate = new Date(event.end.date + 'T12:00:00Z')
        endDate.setDate(endDate.getDate() - 1)
        const endDateStr = endDate.toISOString().split('T')[0]
        const dates = getAllDayDateRange(startParsed.dateString, endDateStr)
        for (const date of dates) {
          if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
          ;['early_morning', 'late_morning', 'early_afternoon', 'late_afternoon', 'evening', 'late_night'].forEach(s => busySlotsByDate.get(date)!.add(s))
        }
        if (isHotelEvent(event.summary, event.location)) {
          const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
          if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
            hotelStays.push({ startDate: startParsed.dateString, endDate: endDateStr, city: hotelCity })
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
      getEventTimeSlots(startTime, endTime, timezone).forEach(s => busySlotsByDate.get(date)!.add(s))
    }

    if (isFlightEvent(event.summary)) {
      const city = resolveToCity(extractFlightDestination(event.summary))
      const isReturn = city ? isCityMatchingHome(city, homeAddress) : false
      const dateStr = getDateString(startTime, timezone)
      allFlights.push({ date: dateStr, timestamp: startTime.getTime(), city, isReturn })
    } else if (isHotelEvent(event.summary, event.location)) {
      const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
      if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
        hotelStays.push({ startDate: getDateString(startTime, timezone), endDate: getDateString(endTime, timezone), city: hotelCity })
      }
    }
  }

  allFlights.sort((a, b) => a.timestamp - b.timestamp)

  const flightLocationByDate: Map<string, string> = new Map()
  for (const flight of allFlights) {
    if (flight.city && !flight.isReturn) flightLocationByDate.set(flight.date, flight.city)
  }

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

  const outboundEntries = Array.from(flightLocationByDate.entries()).sort(([a], [b]) => a.localeCompare(b))
  for (const [outDate, city] of outboundEntries) {
    let hasReturn = false
    const maxReturnDate = new Date(outDate + 'T00:00:00Z'); maxReturnDate.setDate(maxReturnDate.getDate() + 30)
    const maxReturnStr = maxReturnDate.toISOString().split('T')[0]
    for (const rf of allFlights) {
      if (rf.date > outDate && rf.date <= maxReturnStr && (rf.isReturn || (!rf.isReturn && rf.city && rf.city !== city))) { hasReturn = true; break }
    }
    const fillLimit = hasReturn ? 30 : 7
    const current = new Date(outDate); current.setDate(current.getDate() + 1)
    for (let i = 0; i < fillLimit; i++) {
      const dateStr = current.toISOString().split('T')[0]
      if (allFlightDatesSet.has(dateStr)) break
      flightLocationByDate.set(dateStr, city)
      current.setDate(current.getDate() + 1)
    }
  }

  const allLocationByDate = new Map(flightLocationByDate)
  for (const stay of hotelStays) {
    const dates = getDateRange(stay.startDate, stay.endDate)
    for (const d of dates) {
      if (!allLocationByDate.has(d)) allLocationByDate.set(d, stay.city)
    }
  }

  const syncRangeStart = getDateString(threeMonthsAgo, timezone)
  const syncRangeEnd = getDateString(threeMonthsAhead, timezone)
  const { data: existingAvailabilityRows } = await adminClient
    .from('availability')
    .select('date, location_status, trip_location')
    .eq('user_id', userId)
    .gte('date', syncRangeStart)
    .lte('date', syncRangeEnd)

  const existingAvailabilityByDate = new Map(
    (existingAvailabilityRows || []).map((row: any) => [row.date, row])
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
    const { error } = await adminClient.from('availability').upsert({ user_id: userId, date, ...slotUpdates, ...locationFields }, { onConflict: 'user_id,date', ignoreDuplicates: false })
    if (!error) updatedCount++
  }

  for (const [date, city] of allLocationByDate) {
    if (busySlotsByDate.has(date)) continue
    await adminClient.from('availability').upsert(
      { user_id: userId, date, location_status: 'away', trip_location: city },
      { onConflict: 'user_id,date', ignoreDuplicates: false }
    )
    updatedCount++
  }

  for (const existingRow of (existingAvailabilityRows || [])) {
    if (busySlotsByDate.has(existingRow.date) || allLocationByDate.has(existingRow.date)) continue
    const isReturnDate = returnHomeDates.has(existingRow.date)
    const shouldClear = isReturnDate ||
      (existingRow.trip_location && isCityMatchingHome(existingRow.trip_location, homeAddress)) ||
      (existingRow.trip_location && !isCityMatchingHome(existingRow.trip_location, homeAddress) && isDateAfterReturn(existingRow.date, returnHomeDates, outboundFlightDates))
    if (shouldClear) {
      await adminClient.from('availability').upsert(
        { user_id: userId, date: existingRow.date, location_status: 'home', trip_location: null },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )
    }
  }

  const pendingReturnTrips: { city: string; departureDate: string }[] = []
  for (const [outDate, city] of outboundEntries) {
    const resolvedTrip = (existingTrips || []).find((trip: any) =>
      !trip.needs_return_date && isLocationMatch(trip.location, city) && trip.start_date <= outDate && trip.end_date >= outDate
    )
    if (resolvedTrip) continue

    let hasReturn = false
    const maxReturnDate = new Date(outDate + 'T00:00:00Z'); maxReturnDate.setDate(maxReturnDate.getDate() + 30)
    const maxReturnStr = maxReturnDate.toISOString().split('T')[0]
    for (const rf of allFlights) {
      if (rf.date > outDate && rf.date <= maxReturnStr && (rf.isReturn || (!rf.isReturn && rf.city && rf.city !== city))) { hasReturn = true; break }
    }
    if (!hasReturn) pendingReturnTrips.push({ city, departureDate: outDate })
  }

  await adminClient.rpc('merge_overlapping_trips', { p_user_id: userId })

  if (pendingReturnTrips.length > 0) {
    for (const prt of pendingReturnTrips) {
      await adminClient.from('trips').update({ needs_return_date: true })
        .eq('user_id', userId).eq('location', prt.city).gte('start_date', prt.departureDate)
    }
  }

  // ── Sync plans using shared reconciliation ──
  const incomingEventIds = new Set<string>()
  const planRowsByEventId = new Map<string, any>()

  for (const event of events) {
    let localDateStr: string
    let hour: number
    let startTimeStr: string | null
    let endTimeStr: string | null

    if (event.start.dateTime) {
      const startDate = new Date(event.start.dateTime)
      hour = getHourInTimezone(startDate, timezone)
      localDateStr = getDateString(startDate, timezone)
      startTimeStr = formatTimeHHMM(startDate, timezone)
      endTimeStr = event.end.dateTime ? formatTimeHHMM(new Date(event.end.dateTime), timezone) : null
    } else if (event.start.date) {
      // All-day event: parse date string directly to avoid timezone shift
      localDateStr = event.start.date
      hour = 12
      startTimeStr = null
      endTimeStr = null
    } else {
      continue
    }

    const timeSlotHyphen = getTimeSlot(hour).replace('_', '-')

    incomingEventIds.add(event.id)
    planRowsByEventId.set(event.id, {
      user_id: userId, title: event.summary || 'Gcal imported event',
      activity: classifyActivity(event.summary),
      date: `${localDateStr}T12:00:00+00:00`, time_slot: timeSlotHyphen, duration: 1,
      source: 'gcal', source_event_id: event.id,
      start_time: startTimeStr, end_time: endTimeStr,
      source_timezone: timezone || null,
    })
  }

  await reconcilePlans({ adminClient, userId, source: 'gcal', planRowsByEventId, incomingEventIds })

  return { eventsProcessed: events.length, datesUpdated: updatedCount }
}

// ── iCal Sync Logic ─────────────────────────────────────────────────────────

async function syncICalCalendar(adminClient: any, userId: string): Promise<{ eventsProcessed: number; datesUpdated: number }> {
  const { data: connRows, error: connError } = await adminClient
    .from('calendar_connections')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'ical')

  if (connError || !connRows || connRows.length === 0) throw new Error('iCal not connected')

  const { data: profileData } = await adminClient
    .from('profiles')
    .select('home_address, timezone')
    .eq('user_id', userId)
    .single()

  const homeAddress: string | null = profileData?.home_address || null
  const userTimezone: string | undefined = profileData?.timezone || undefined

  const icalUrl = connRows[0].access_token
  if (!icalUrl) throw new Error('No iCal URL stored')

  const icsResponse = await fetch(icalUrl)
  if (!icsResponse.ok) throw new Error('Failed to fetch iCal feed')
  const icsText = await icsResponse.text()
  if (!icsText.includes('BEGIN:VCALENDAR')) throw new Error('Invalid iCal data')

  const now = new Date()
  const rangeStart = new Date(now); rangeStart.setMonth(rangeStart.getMonth() - 3)
  const rangeEnd = new Date(now); rangeEnd.setMonth(rangeEnd.getMonth() + 3)
  const events = parseICS(icsText, rangeStart, rangeEnd)

  // ── Busy slots ──
  const busySlotsByDate: Map<string, Set<string>> = new Map()
  const allFlights: FlightInfo[] = []
  const hotelStays: HotelStay[] = []

  for (const event of events) {
    if (event.isAllDay) {
      // Parse all-day dates directly to avoid timezone shift
      const startDateStr = event.dtstart.toISOString().split('T')[0]
      const endExcl = new Date(event.dtend); endExcl.setDate(endExcl.getDate() - 1)
      const endDateStr = endExcl.toISOString().split('T')[0]
      const dates = getAllDayDateRange(startDateStr, endDateStr)
      for (const date of dates) {
        if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
        ;['early_morning', 'late_morning', 'early_afternoon', 'late_afternoon', 'evening', 'late_night'].forEach(s => busySlotsByDate.get(date)!.add(s))
      }
      if (isHotelEvent(event.summary, event.location)) {
        const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
        if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
          hotelStays.push({ startDate: startDateStr, endDate: endDateStr, city: hotelCity })
        }
      }
      continue
    }
    for (const date of getEventDates(event.dtstart, event.dtend)) {
      if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
      getEventTimeSlots(event.dtstart, event.dtend).forEach(s => busySlotsByDate.get(date)!.add(s))
    }

    // Detect flights and hotels (same logic as Google sync)
    if (isFlightEvent(event.summary)) {
      const city = resolveToCity(extractFlightDestination(event.summary))
      const isReturn = city ? isCityMatchingHome(city, homeAddress) : false
      const dateStr = getDateString(event.dtstart, userTimezone)
      allFlights.push({ date: dateStr, timestamp: event.dtstart.getTime(), city, isReturn })
      console.log(`[ical-sync] Flight detected: "${event.summary}" → city=${city}, isReturn=${isReturn}, date=${dateStr}`)
    } else if (isHotelEvent(event.summary, event.location)) {
      const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
      if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
        hotelStays.push({ startDate: getDateString(event.dtstart, userTimezone), endDate: getDateString(event.dtend, userTimezone), city: hotelCity })
      }
    }
  }

  // ── Flight/hotel location processing (same as Google sync) ──
  allFlights.sort((a, b) => a.timestamp - b.timestamp)

  const flightLocationByDate: Map<string, string> = new Map()
  for (const flight of allFlights) {
    if (flight.city && !flight.isReturn) flightLocationByDate.set(flight.date, flight.city)
  }

  const allFlightDatesSet = new Set(allFlights.map(f => f.date))
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

  const outboundEntries = Array.from(flightLocationByDate.entries()).sort(([a], [b]) => a.localeCompare(b))
  for (const [outDate, city] of outboundEntries) {
    let hasReturn = false
    const maxReturnDate = new Date(outDate + 'T00:00:00Z'); maxReturnDate.setDate(maxReturnDate.getDate() + 30)
    const maxReturnStr = maxReturnDate.toISOString().split('T')[0]
    for (const rf of allFlights) {
      if (rf.date > outDate && rf.date <= maxReturnStr && (rf.isReturn || (!rf.isReturn && rf.city && rf.city !== city))) { hasReturn = true; break }
    }
    const fillLimit = hasReturn ? 30 : 7
    const current = new Date(outDate); current.setDate(current.getDate() + 1)
    for (let i = 0; i < fillLimit; i++) {
      const dateStr = current.toISOString().split('T')[0]
      if (allFlightDatesSet.has(dateStr)) break
      flightLocationByDate.set(dateStr, city)
      current.setDate(current.getDate() + 1)
    }
  }

  const allLocationByDate = new Map(flightLocationByDate)
  for (const stay of hotelStays) {
    const dates = getDateRange(stay.startDate, stay.endDate)
    for (const d of dates) {
      if (!allLocationByDate.has(d)) allLocationByDate.set(d, stay.city)
    }
  }

  // ── Upsert availability with location info ──
  let updatedCount = 0
  for (const [date, slots] of busySlotsByDate) {
    const slotUpdates: Record<string, boolean> = {}
    for (const slot of slots) slotUpdates[slot] = false
    const locationCity = allLocationByDate.get(date)
    const isReturnDate = returnHomeDates.has(date)
    const locationFields: Record<string, string | null> = {}
    if (locationCity) {
      locationFields.location_status = 'away'
      locationFields.trip_location = locationCity
    } else if (isReturnDate) {
      locationFields.location_status = 'home'
      locationFields.trip_location = null
    }
    const { error } = await adminClient.from('availability').upsert(
      { user_id: userId, date, ...slotUpdates, ...locationFields },
      { onConflict: 'user_id,date', ignoreDuplicates: false }
    )
    if (!error) updatedCount++
  }

  // Upsert location-only dates (no busy slots but has location from flights/hotels)
  for (const [date, city] of allLocationByDate) {
    if (busySlotsByDate.has(date)) continue
    await adminClient.from('availability').upsert(
      { user_id: userId, date, location_status: 'away', trip_location: city },
      { onConflict: 'user_id,date', ignoreDuplicates: false }
    )
    updatedCount++
  }

  // ── Trip merge ──
  await adminClient.rpc('merge_overlapping_trips', { p_user_id: userId })

  // ── Sync plans using shared reconciliation ──
  const incomingEventIds = new Set<string>()
  const planRowsByEventId = new Map<string, any>()

  for (const event of events) {
    const hour = event.isAllDay ? 8 : event.dtstart.getUTCHours()
    const localDateStr = getDateString(event.dtstart)
    const icalStartTime = !event.isAllDay ? formatTimeHHMM(event.dtstart, userTimezone) : null
    const icalEndTime = !event.isAllDay && event.dtend ? formatTimeHHMM(event.dtend, userTimezone) : null

    incomingEventIds.add(event.uid)
    planRowsByEventId.set(event.uid, {
      user_id: userId, title: (event.summary || 'iCal imported event').replace(/\s+/g, ' ').trim(),
      activity: classifyActivity(event.summary), date: `${localDateStr}T12:00:00+00:00`,
      time_slot: getTimeSlot(hour).replace('_', '-'), duration: 1,
      location: event.location || null, source: 'ical', source_event_id: event.uid,
      source_timezone: userTimezone || null,
      start_time: icalStartTime, end_time: icalEndTime,
    })
  }

  await reconcilePlans({ adminClient, userId, source: 'ical', planRowsByEventId, incomingEventIds })

  return { eventsProcessed: events.length, datesUpdated: updatedCount }
}

// ── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { userId, provider } = body

    if (!userId || !provider) {
      return new Response(JSON.stringify({ error: 'Missing userId or provider' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let result: { eventsProcessed: number; datesUpdated: number }

    if (provider === 'google') {
      result = await syncGoogleCalendar(adminClient, userId)
    } else if (provider === 'ical') {
      result = await syncICalCalendar(adminClient, userId)
    } else {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ synced: true, ...result, message: `Synced ${result.eventsProcessed} events` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Worker sync error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message, synced: false }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
