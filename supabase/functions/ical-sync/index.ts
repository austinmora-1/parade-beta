import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getTimeSlot, getHourInTimezone, getDateString, getEventTimeSlots, getEventDates,
  formatTimeHHMM, getDateRange,
  resolveToCity, extractFlightDestination, isFlightEvent,
  isCityMatchingHome, isLocationMatch, isDateAfterReturn,
  isHotelEvent, extractHotelLocation,
  classifyActivity, parseICS, reconcilePlans,
  type ICalEvent, type FlightInfo, type HotelStay, type PendingReturnTrip,
} from '../_shared/calendar-helpers.ts'

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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      console.error('iCal fetch error:', icsResponse.status, await icsResponse.text())
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
    const rangeStart = new Date(now); rangeStart.setMonth(rangeStart.getMonth() - 3)
    const rangeEnd = new Date(now); rangeEnd.setMonth(rangeEnd.getMonth() + 3)
    const events = parseICS(icsText, rangeStart, rangeEnd)

    // Fetch user's home address for flight detection
    const { data: profileData } = await adminClient
      .from('profiles')
      .select('home_address, timezone')
      .eq('user_id', userId)
      .single()
    const homeAddress: string | null = profileData?.home_address || null
    const userTimezone = timezone || profileData?.timezone

    // ── Update availability ────────────────────────────────────────────────
    const busySlotsByDate: Map<string, Set<string>> = new Map()
    const allFlights: FlightInfo[] = []
    const hotelStays: HotelStay[] = []

    for (const event of events) {
      if (event.isAllDay) {
        const endExclusive = new Date(event.dtend); endExclusive.setDate(endExclusive.getDate() - 1)
        const dates = getEventDates(event.dtstart, endExclusive, userTimezone)
        for (const date of dates) {
          if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
          ;['early_morning', 'late_morning', 'early_afternoon', 'late_afternoon', 'evening', 'late_night'].forEach(
            slot => busySlotsByDate.get(date)!.add(slot)
          )
        }
        if (isHotelEvent(event.summary, event.location)) {
          const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
          if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
            const endExcl = new Date(event.dtend); endExcl.setDate(endExcl.getDate() - 1)
            hotelStays.push({
              startDate: getDateString(event.dtstart, userTimezone),
              endDate: getDateString(endExcl, userTimezone),
              city: hotelCity,
            })
          }
        }
        continue
      }

      const dates = getEventDates(event.dtstart, event.dtend, userTimezone)
      for (const date of dates) {
        if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
        getEventTimeSlots(event.dtstart, event.dtend, userTimezone).forEach(slot => busySlotsByDate.get(date)!.add(slot))
      }

      if (isFlightEvent(event.summary)) {
        const city = resolveToCity(extractFlightDestination(event.summary))
        const isReturn = city ? isCityMatchingHome(city, homeAddress) : false
        const dateStr = getDateString(event.dtstart, userTimezone)
        const ts = event.dtstart.getTime()
        console.log(`[FLIGHT] "${event.summary}" | dtstart=${event.dtstart.toISOString()} | ts=${ts} | dateStr=${dateStr} | city=${city} | isReturn=${isReturn}`)
        allFlights.push({ date: dateStr, timestamp: ts, city, isReturn })
      } else if (isHotelEvent(event.summary, event.location)) {
        const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
        if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
          hotelStays.push({
            startDate: getDateString(event.dtstart, userTimezone),
            endDate: getDateString(event.dtend, userTimezone),
            city: hotelCity,
          })
        }
      }
    }

    // Sort flights chronologically
    allFlights.sort((a, b) => a.timestamp - b.timestamp)
    console.log(`[FLIGHTS SORTED] ${allFlights.map(f => `${f.city}@${f.date}(ts=${f.timestamp})`).join(' → ')}`)

    // Build flightLocationByDate: last leg wins
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

    // Detect one-way flights
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
      const maxReturnDate = new Date(outDate + 'T00:00:00Z'); maxReturnDate.setDate(maxReturnDate.getDate() + 30)
      const maxReturnStr = maxReturnDate.toISOString().split('T')[0]

      for (const rf of allFlights) {
        if (rf.date > outDate && rf.date <= maxReturnStr && rf.isReturn) { hasReturn = true; break }
        if (rf.date > outDate && rf.date <= maxReturnStr && !rf.isReturn && rf.city && rf.city !== city) { hasReturn = true; break }
      }

      if (hasReturn) {
        const current = new Date(outDate); current.setDate(current.getDate() + 1)
        for (let i = 0; i < 30; i++) {
          const dateStr = current.toISOString().split('T')[0]
          if (allFlightDatesSet.has(dateStr)) break
          flightLocationByDate.set(dateStr, city)
          current.setDate(current.getDate() + 1)
        }
      } else {
        const current = new Date(outDate); current.setDate(current.getDate() + 1)
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
    const allLocationByDate = new Map(flightLocationByDate)
    for (const stay of hotelStays) {
      const dates = getDateRange(stay.startDate, stay.endDate)
      for (const d of dates) {
        if (!allLocationByDate.has(d)) allLocationByDate.set(d, stay.city)
      }
    }

    // Fetch existing availability for stale-away cleanup
    const syncRangeStart = getDateString(rangeStart, userTimezone)
    const syncRangeEnd = getDateString(rangeEnd, userTimezone)
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

      const { error } = await adminClient.from('availability').upsert(
        { user_id: userId, date, ...slotUpdates, ...locationFields },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )
      if (!error) updatedCount++
    }

    for (const [date, city] of allLocationByDate) {
      if (busySlotsByDate.has(date)) continue
      const { error } = await adminClient.from('availability').upsert(
        { user_id: userId, date, location_status: 'away', trip_location: city },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )
      if (!error) updatedCount++
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

    await adminClient.rpc('merge_overlapping_trips', { p_user_id: userId })

    if (pendingReturnTrips.length > 0) {
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

    // ── Sync plans using shared reconciliation ────────────────────────────
    const incomingEventIds = new Set<string>()
    const planRowsByEventId = new Map<string, any>()

    for (const event of events) {
      const hour = event.isAllDay ? 8 : getHourInTimezone(event.dtstart, userTimezone)
      const timeSlot = getTimeSlot(hour).replace('_', '-')
      const localDateStr = getDateString(event.dtstart, userTimezone)
      const planDate = `${localDateStr}T12:00:00+00:00`
      const startTimeStr = event.isAllDay ? null : formatTimeHHMM(event.dtstart, userTimezone)
      const endTimeStr = event.isAllDay ? null : formatTimeHHMM(event.dtend, userTimezone)

      incomingEventIds.add(event.uid)
      planRowsByEventId.set(event.uid, {
        user_id: userId,
        title: (event.summary || 'iCal imported event').replace(/\s+/g, ' ').trim(),
        activity: classifyActivity(event.summary),
        date: planDate,
        time_slot: timeSlot,
        duration: 1,
        location: event.location || null,
        source: 'ical',
        source_event_id: event.uid,
        start_time: startTimeStr,
        end_time: endTimeStr,
        source_timezone: userTimezone || null,
      })
    }

    await reconcilePlans({ adminClient, userId, source: 'ical', planRowsByEventId, incomingEventIds })

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
