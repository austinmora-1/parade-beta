import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getTimeSlot, getHourInTimezone, getDateString, getEventTimeSlots, getEventDates,
  formatTimeHHMM, parseAllDayDate, getAllDayDateRange,
  resolveToCity, extractFlightDestination, extractFlightDepartureCity, isFlightEvent,
  isCityMatchingHome,
  isHotelEvent, extractHotelLocation,
  classifyActivity, parseICS, reconcilePlans, fetchAllGoogleEvents,
  resolveLocationsByDate, upsertAvailabilityWithLocation, resolveSlotLocations,
  type ICalEvent, type FlightInfo, type HotelStay,
  type CalendarEvent,
} from '../_shared/calendar-helpers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GCalEvent extends CalendarEvent {}

// ── Shared flight/hotel collection for Google events ────────────────────────

function collectGoogleFlightsAndHotels(
  events: GCalEvent[],
  busySlotsByDate: Map<string, Set<string>>,
  allFlights: FlightInfo[],
  hotelStays: HotelStay[],
  homeAddress: string | null,
  timezone?: string,
) {
  for (const event of events) {
    if (!event.start.dateTime || !event.end.dateTime) {
      if (event.start.date && event.end.date) {
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
      return // skip non-timed events for flight detection
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
      const departureCity = resolveToCity(extractFlightDepartureCity(event.summary))
      const isReturn = city ? isCityMatchingHome(city, homeAddress) : false
      const dateStr = getDateString(startTime, timezone)
      const arrivalTimestamp = endTime.getTime()
      allFlights.push({ date: dateStr, timestamp: startTime.getTime(), arrivalTimestamp, city, departureCity, isReturn })
    } else if (isHotelEvent(event.summary, event.location)) {
      const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
      if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
        hotelStays.push({ startDate: getDateString(startTime, timezone), endDate: getDateString(endTime, timezone), city: hotelCity })
      }
    }
  }
}

// ── Shared flight/hotel collection for iCal events ──────────────────────────

function collectICalFlightsAndHotels(
  events: ICalEvent[],
  busySlotsByDate: Map<string, Set<string>>,
  allFlights: FlightInfo[],
  hotelStays: HotelStay[],
  homeAddress: string | null,
  userTimezone?: string,
) {
  for (const event of events) {
    if (event.isAllDay) {
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

    if (isFlightEvent(event.summary)) {
      const city = resolveToCity(extractFlightDestination(event.summary))
      const departureCity = resolveToCity(extractFlightDepartureCity(event.summary))
      const isReturn = city ? isCityMatchingHome(city, homeAddress) : false
      const dateStr = getDateString(event.dtstart, userTimezone)
      allFlights.push({ date: dateStr, timestamp: event.dtstart.getTime(), arrivalTimestamp: event.dtend.getTime(), city, departureCity, isReturn })
    } else if (isHotelEvent(event.summary, event.location)) {
      const hotelCity = resolveToCity(extractHotelLocation(event.summary, event.location))
      if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
        hotelStays.push({ startDate: getDateString(event.dtstart, userTimezone), endDate: getDateString(event.dtend, userTimezone), city: hotelCity })
      }
    }
  }
}

// ── Google Calendar Sync ────────────────────────────────────────────────────

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
    accessToken, threeMonthsAgo.toISOString(), threeMonthsAhead.toISOString(),
  )

  const busySlotsByDate: Map<string, Set<string>> = new Map()
  const allFlights: FlightInfo[] = []
  const hotelStays: HotelStay[] = []

  collectGoogleFlightsAndHotels(events, busySlotsByDate, allFlights, hotelStays, homeAddress, timezone)

  const { data: existingTrips } = await adminClient
    .from('trips')
    .select('id, location, start_date, end_date, needs_return_date')
    .eq('user_id', userId)

  const { locationByDate, returnHomeDates, outboundFlightDates, pendingReturnTrips } = resolveLocationsByDate({
    allFlights, hotelStays, homeAddress, existingTrips: existingTrips || [],
  })

  const syncRangeStart = getDateString(threeMonthsAgo, timezone)
  const syncRangeEnd = getDateString(threeMonthsAhead, timezone)

  const updatedCount = await upsertAvailabilityWithLocation({
    adminClient, userId, busySlotsByDate, locationByDate,
    returnHomeDates, outboundFlightDates, pendingReturnTrips,
    homeAddress, syncRangeStart, syncRangeEnd,
  })

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

  const busySlotsByDate: Map<string, Set<string>> = new Map()
  const allFlights: FlightInfo[] = []
  const hotelStays: HotelStay[] = []

  collectICalFlightsAndHotels(events, busySlotsByDate, allFlights, hotelStays, homeAddress, userTimezone)

  const { data: existingTrips } = await adminClient
    .from('trips')
    .select('id, location, start_date, end_date, needs_return_date')
    .eq('user_id', userId)

  const { locationByDate, returnHomeDates, outboundFlightDates, pendingReturnTrips } = resolveLocationsByDate({
    allFlights, hotelStays, homeAddress, existingTrips: existingTrips || [],
  })

  const syncRangeStart = getDateString(rangeStart, userTimezone)
  const syncRangeEnd = getDateString(rangeEnd, userTimezone)

  const updatedCount = await upsertAvailabilityWithLocation({
    adminClient, userId, busySlotsByDate, locationByDate,
    returnHomeDates, outboundFlightDates, pendingReturnTrips,
    homeAddress, syncRangeStart, syncRangeEnd,
  })

  // ── Sync plans ──
  const incomingEventIds = new Set<string>()
  const planRowsByEventId = new Map<string, any>()

  for (const event of events) {
    let localDateStr: string
    let hour: number

    if (event.isAllDay) {
      localDateStr = event.dtstart.toISOString().split('T')[0]
      hour = 12
    } else {
      localDateStr = getDateString(event.dtstart)
      hour = event.dtstart.getUTCHours()
    }

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
