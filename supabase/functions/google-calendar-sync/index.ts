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
function getEventTimeSlots(startTime: Date, endTime: Date, timezone?: string): string[] {
  const slots = new Set<string>()

  // Iterate through each hour the event covers
  const current = new Date(startTime)
  while (current < endTime) {
    const hour = getHourInTimezone(current, timezone)
    slots.add(getTimeSlot(hour))
    current.setTime(current.getTime() + 60 * 60 * 1000)
  }

  return Array.from(slots)
}

// Get date string in YYYY-MM-DD format in a given timezone
function getDateString(date: Date, timezone?: string): string {
  if (timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
    return parts // en-CA gives YYYY-MM-DD
  }
  return date.toISOString().split('T')[0]
}

// Get the hour in a given timezone
function getHourInTimezone(date: Date, timezone?: string): number {
  if (timezone) {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(date), 10)
  }
  return date.getHours()
}

// Get all dates that an event spans
function getEventDates(startTime: Date, endTime: Date, timezone?: string): string[] {
  const dates: string[] = []
  // Use timezone-aware date strings to iterate
  const seen = new Set<string>()
  const current = new Date(startTime)
  while (current <= endTime) {
    const d = getDateString(current, timezone)
    if (!seen.has(d)) {
      seen.add(d)
      dates.push(d)
    }
    current.setTime(current.getTime() + 60 * 60 * 1000) // step by 1 hour
  }
  return dates
}

// Common airport codes → city names
const AIRPORT_CITY_MAP: Record<string, string> = {
  // US
  ATL: 'Atlanta', BOS: 'Boston', BWI: 'Baltimore', CLT: 'Charlotte', DCA: 'Washington DC',
  DEN: 'Denver', DFW: 'Dallas', DTW: 'Detroit', EWR: 'New York City', FLL: 'Fort Lauderdale',
  HNL: 'Honolulu', IAD: 'Washington DC', IAH: 'Houston', JFK: 'New York City', LAS: 'Las Vegas',
  LAX: 'Los Angeles', LGA: 'New York City', MCI: 'Kansas City', MCO: 'Orlando', MDW: 'Chicago',
  MIA: 'Miami', MSP: 'Minneapolis', MSY: 'New Orleans', OAK: 'Oakland', ORD: 'Chicago',
  PDX: 'Portland', PHL: 'Philadelphia', PHX: 'Phoenix', PIT: 'Pittsburgh', RDU: 'Raleigh',
  SAN: 'San Diego', SAT: 'San Antonio', SEA: 'Seattle', SFO: 'San Francisco', SJC: 'San Jose',
  SLC: 'Salt Lake City', SMF: 'Sacramento', STL: 'St. Louis', TPA: 'Tampa',
  AUS: 'Austin', BNA: 'Nashville', IND: 'Indianapolis', JAX: 'Jacksonville', MKE: 'Milwaukee',
  OMA: 'Omaha', RNO: 'Reno', BUR: 'Burbank', SNA: 'Orange County', ONT: 'Ontario',
  // Canada
  YYZ: 'Toronto', YVR: 'Vancouver', YUL: 'Montreal', YOW: 'Ottawa', YYC: 'Calgary',
  // International
  LHR: 'London', LGW: 'London', CDG: 'Paris', ORY: 'Paris', FCO: 'Rome', AMS: 'Amsterdam',
  FRA: 'Frankfurt', MUC: 'Munich', MAD: 'Madrid', BCN: 'Barcelona', LIS: 'Lisbon',
  DUB: 'Dublin', ZRH: 'Zurich', CPH: 'Copenhagen', ARN: 'Stockholm', OSL: 'Oslo',
  HEL: 'Helsinki', VIE: 'Vienna', BRU: 'Brussels', ATH: 'Athens', IST: 'Istanbul',
  NRT: 'Tokyo', HND: 'Tokyo', ICN: 'Seoul', PEK: 'Beijing', PVG: 'Shanghai',
  HKG: 'Hong Kong', SIN: 'Singapore', BKK: 'Bangkok', SYD: 'Sydney', MEL: 'Melbourne',
  AKL: 'Auckland', DEL: 'Delhi', BOM: 'Mumbai', DXB: 'Dubai', DOH: 'Doha',
  GRU: 'São Paulo', EZE: 'Buenos Aires', MEX: 'Mexico City', CUN: 'Cancún',
  BOG: 'Bogotá', LIM: 'Lima', SCL: 'Santiago', JNB: 'Johannesburg', CAI: 'Cairo',
  NBO: 'Nairobi', CPT: 'Cape Town',
}

// Extract destination city from a flight event
function extractFlightDestination(summary?: string): string | null {
  if (!summary) return null
  const upper = summary.toUpperCase()

  // Look for 3-letter airport codes - try to find the LAST one (destination)
  const codes = upper.match(/\b([A-Z]{3})\b/g)
  if (codes) {
    // Filter to only known airport codes
    const airports = codes.filter(c => c in AIRPORT_CITY_MAP)
    if (airports.length > 0) {
      // Last matched airport code is likely the destination
      return AIRPORT_CITY_MAP[airports[airports.length - 1]]
    }
  }

  // Fallback: match "Flight to <City>" pattern (e.g. "Flight to Dallas (AA 1849)")
  const flightToMatch = summary.match(/\bflight\s+to\s+([A-Za-z\s]+?)(?:\s*\(|$)/i)
  if (flightToMatch) {
    const city = flightToMatch[1].trim()
    if (city.length >= 3) return city
  }

  return null
}

// Detect if an event is a flight
function isFlightEvent(event: CalendarEvent): boolean {
  const s = (event.summary || '').toLowerCase()
  // Common patterns: "Flight to ...", airline names, flight numbers
  if (/\bflight\b/.test(s)) return true
  if (/\b(united|delta|american|southwest|jetblue|alaska|spirit|frontier|british airways|lufthansa|air france|emirates|qatar)\b/.test(s)) return true
  // Pattern like "AA 123", "UA1234", "DL 456"
  if (/\b[A-Z]{2}\s?\d{1,4}\b/i.test(event.summary || '')) {
    // Verify it also has airport codes
    const codes = (event.summary || '').toUpperCase().match(/\b([A-Z]{3})\b/g)
    if (codes?.some(c => c in AIRPORT_CITY_MAP)) return true
  }
  return false
}

interface CalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

// Format a Date to HH:MM in the given timezone
function formatTimeHHMM(date: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
  if (timezone) opts.timeZone = timezone
  const parts = new Intl.DateTimeFormat('en-GB', opts).format(date)
  return parts // en-GB gives HH:MM
}
// Classify a calendar event into a Parade activity type based on its title
function classifyActivity(summary?: string, isFlight = false): string {
  if (isFlight) return 'flight'
  if (!summary) return 'hanging-out'
  const s = summary.toLowerCase()

  // ── Flights ──
  if (/\bflight\b/.test(s)) return 'flight'

  // ── Social ──
  if (/\b(drinks|happy\s*hour|bar|cocktail|cocktails|beer|beers|pub|brewery|nightclub|club)\b/.test(s)) return 'drinks'
  if (/\b(museum|exhibit|exhibition|gallery)\b/.test(s)) return 'museum'
  if (/\b(sightsee|sightseeing|tourist|tour)\b/.test(s)) return 'sightseeing'
  if (/\b(dinner|lunch|brunch|breakfast|restaurant|eat|eating|supper|bistro|diner|sushi|pizza|ramen|taco|tapas|dim\s*sum|buffet)\b/.test(s)) return 'dinner'
  if (/\b(concert|live\s*music|gig)\b/.test(s)) return 'concert'
  if (/\b(1[:\s]*1|one[\s-]*on[\s-]*one|catch\s*up|coffee|cafe|café|tea|espresso|latte|matcha)\b/.test(s)) return 'one-on-one'
  if (/\b(beach|shore|ocean|seaside)\b/.test(s)) return 'beach'
  if (/\b(stand[\s-]*up|comedy|comic|improv)\b/.test(s)) return 'stand-up-comedy'
  if (/\b(theme\s*park|amusement|roller\s*coaster|disney|six\s*flags|universal)\b/.test(s)) return 'theme-park'
  if (/\b(camp|camping|campfire|campsite|glamping)\b/.test(s)) return 'camping'
  if (/\b(video\s*game|gaming|game\s*night|board\s*game|xbox|playstation|nintendo|switch)\b/.test(s)) return 'video-games'
  if (/\b(facetime|zoom|video\s*call|google\s*meet|teams\s*call)\b/.test(s)) return 'facetime'
  if (/\b(game|match|stadium|arena|sports\s*event)\b/.test(s) && !/\bvideo\b/.test(s)) return 'sports-event'
  if (/\b(larp|larping)\b/.test(s)) return 'larping'
  if (/\b(ballet|dance\s*recital|dance\s*performance)\b/.test(s)) return 'ballet'
  if (/\b(dancing|dance\s*class|salsa|swing\s*dance|line\s*dance)\b/.test(s)) return 'dancing'
  if (/\b(opera)\b/.test(s)) return 'opera'
  if (/\b(comic[\s-]*con|cosplay|convention|con\b|anime\s*expo)\b/.test(s)) return 'comic-con'
  if (/\b(hang|hanging\s*out|get[\s-]*together|kickback|hangout)\b/.test(s)) return 'hanging-out'

  // ── Chill ──
  if (/\b(listen|music|playlist|spotify|vinyl|record)\b/.test(s) && !/\b(concert|live)\b/.test(s)) return 'listening-music'
  if (/\b(movie|movies|cinema|film|screening)\b/.test(s)) return 'movies'
  if (/\b(watch|tv|netflix|hulu|streaming|binge|show|series)\b/.test(s) && !/\b(sports|game|match)\b/.test(s)) return 'watching-tv'
  if (/\b(park|picnic|garden|botanical)\b/.test(s)) return 'park'
  if (/\b(grill|grilling|bbq|barbecue|cookout)\b/.test(s)) return 'grilling'
  if (/\b(theater|theatre|play|musical|show|performance)\b/.test(s)) return 'movies'
  if (/\b(read|reading|book\s*club|library)\b/.test(s)) return 'reading'

  // ── Athletic ──
  if (/\b(surf|surfing|bodyboard)\b/.test(s)) return 'surfing'
  if (/\b(gym|weight\s*lifting|weightlifting|lifting|crossfit|cross[\s-]?fit|strength|conditioning|bootcamp|boot\s*camp|f45|orangetheory|equinox)\b/.test(s)) return 'gym'
  if (/\b(yoga|pilates|barre|stretching)\b/.test(s)) return 'yoga'
  if (/\b(run|running|jog|jogging|marathon|5k|10k|half[\s-]?marathon|track|sprint)\b/.test(s)) return 'running'
  if (/\b(workout|exercise|fitness|hiit|tabata|cardio|calisthenics|peloton|soulcycle)\b/.test(s) && /\b(home|indoor|living\s*room)\b/.test(s)) return 'workout-in'
  if (/\b(swim|swimming|pool|laps)\b/.test(s)) return 'swimming'
  if (/\b(hike|hiking|trail|mountain|backpack)\b/.test(s)) return 'hiking'
  if (/\b(walk|walking|stroll|jaywalking)\b/.test(s)) return 'jaywalking'
  if (/\b(workout|exercise|fitness|hiit|tabata|cardio|calisthenics|zumba|spin|spinning|rowing|cycling|bike|biking|boxing|kickboxing|martial\s*arts|karate|judo|jiu[\s-]?jitsu|mma|basketball|soccer|football|tennis|golf|volleyball|baseball|hockey|lacrosse|rugby|cricket|athletics|peloton|soulcycle|class\s*pass|classpass|spartan|triathlon|obstacle)\b/.test(s)) return 'gym'

  // ── Productive ──
  if (/\b(pet|pets|feed|feeding|cat|fish\s*tank)\b/.test(s) && /\b(feed|care|sitting)\b/.test(s)) return 'feeding-pets'
  if (/\b(dog\s*walk|walk\s*(the\s*)?dog|dog\s*park)\b/.test(s)) return 'walking-dog'
  if (/\b(volunteer|volunteering|charity|fundraiser|community\s*service)\b/.test(s)) return 'volunteering'
  if (/\b(wine\s*tasting|winery|vineyard|sommelier)\b/.test(s)) return 'wine-tasting'
  if (/\b(dj|djing|turntable|mix|mixing\s*music)\b/.test(s)) return 'amateur-djing'
  if (/\b(shop|shopping|grocery|groceries|market|mall|store|target|walmart|costco|trader|whole\s*foods)\b/.test(s)) return 'shopping'

  // ── Fallback ──
  return 'hanging-out'
}

// Check if a city name matches a home address
function isCityMatchingHome(city: string, homeAddress: string | null): boolean {
  if (!city || !homeAddress) return false
  const normCity = city.toLowerCase().trim()
  const normHome = homeAddress.toLowerCase().trim()
  if (normHome.includes(normCity) || normCity.includes(normHome)) return true
  // Compare city portion (before comma) stripped of "city/town" suffix
  const homeCity = normHome.split(',')[0].trim().replace(/\s*(city|town|village)$/i, '').trim()
  const flightCity = normCity.replace(/\s*(city|town|village)$/i, '').trim()
  if (homeCity && flightCity && (homeCity.includes(flightCity) || flightCity.includes(homeCity))) return true
  return false
}

// Check if a date falls after a return-home flight but before the next outbound flight
function isDateAfterReturn(dateStr: string, returnDates: Set<string>, outboundDates: Set<string>): boolean {
  // Find the most recent return date on or before this date
  let latestReturn: string | null = null
  for (const rd of returnDates) {
    if (rd <= dateStr && (!latestReturn || rd > latestReturn)) latestReturn = rd
  }
  if (!latestReturn) return false
  // Check no outbound flight between the return and this date
  for (const od of outboundDates) {
    if (od > latestReturn && od <= dateStr) return false
  }
  return true
}

async function handleEventsSync(params: {
  adminClient: any
  userId: string
  events: CalendarEvent[]
  timezone?: string
}) {
  const { adminClient, userId, events, timezone } = params

  // Fetch user's home address to skip return-home flights
  const { data: profileData } = await adminClient
    .from('profiles')
    .select('home_address')
    .eq('user_id', userId)
    .single()
  const homeAddress: string | null = profileData?.home_address || null

  // Build a map of date -> slots to mark as busy
  const busySlotsByDate: Map<string, Set<string>> = new Map()

  for (const event of events) {
    // All-day events (they don't have dateTime)
    if (!event.start.dateTime || !event.end.dateTime) {
      if (event.start.date && event.end.date) {
        const startDate = new Date(event.start.date)
        const endDate = new Date(event.end.date)
        endDate.setDate(endDate.getDate() - 1) // All-day end is exclusive

        const dates = getEventDates(startDate, endDate, timezone)
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

    const dates = getEventDates(startTime, endTime, timezone)

    for (const date of dates) {
      if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())

      // For timezone-aware slot calculation, we need to check each hour
      const slots = getEventTimeSlots(startTime, endTime, timezone)
      slots.forEach((slot) => busySlotsByDate.get(date)!.add(slot))
      slots.forEach((slot) => busySlotsByDate.get(date)!.add(slot))
    }
  }

  // Detect flight events and build a chronological list of flights with dates + destinations
  interface FlightInfo { date: string; city: string | null; isReturn: boolean }
  const allFlights: FlightInfo[] = []
  const flightLocationByDate: Map<string, string> = new Map()

  for (const event of events) {
    if (!isFlightEvent(event)) continue

    const city = extractFlightDestination(event.summary)
    const isReturn = city ? isCityMatchingHome(city, homeAddress) : false

    const startDate = event.start.dateTime ? new Date(event.start.dateTime) : event.start.date ? new Date(event.start.date) : null
    if (!startDate) continue

    const dateStr = getDateString(startDate, timezone)
    allFlights.push({ date: dateStr, city, isReturn })

    // Only mark non-return, recognized flights as away
    if (city && !isReturn) {
      flightLocationByDate.set(dateStr, city)
    }
  }

  // Sort all flights chronologically
  allFlights.sort((a, b) => a.date.localeCompare(b.date))

  // Build a sorted set of ALL flight dates (outbound, return, and unrecognized)
  // These act as trip boundaries — we never fill past any flight date
  const allFlightDatesSet = new Set(allFlights.map(f => f.date))

  // Track return-home flight dates — these should reset location to 'home'
  const returnHomeDates = new Set(allFlights.filter(f => f.isReturn).map(f => f.date))
  const outboundFlightDates = new Set(allFlights.filter(f => !f.isReturn && f.city).map(f => f.date))

  // Fill gap days: for each outbound flight, fill forward until we hit another flight date
  const outboundEntries = Array.from(flightLocationByDate.entries()).sort(([a], [b]) => a.localeCompare(b))

  for (const [outDate, city] of outboundEntries) {
    const current = new Date(outDate)
    current.setDate(current.getDate() + 1)
    // Fill forward up to 30 days max (safety limit)
    for (let i = 0; i < 30; i++) {
      const dateStr = current.toISOString().split('T')[0]
      // Stop if we hit any other flight date (outbound to new city, return, or unrecognized)
      if (allFlightDatesSet.has(dateStr)) break
      flightLocationByDate.set(dateStr, city)
      current.setDate(current.getDate() + 1)
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
    (existingAvailabilityRows || []).map((row: { date: string; location_status: string | null; trip_location: string | null }) => [row.date, row])
  )

  // Update availability table for each date with busy slots
  let updatedCount = 0
  for (const [date, slots] of busySlotsByDate) {
    const slotUpdates: Record<string, boolean> = {}
    for (const slot of slots) slotUpdates[slot] = false

    const flightCity = flightLocationByDate.get(date)
    const existingRow = existingAvailabilityByDate.get(date)
    const isReturnDate = returnHomeDates.has(date)
    const shouldClearStaleHomeAway = !flightCity && !!existingRow?.trip_location && isCityMatchingHome(existingRow.trip_location, homeAddress)
    const shouldClearAfterReturn = !flightCity && !isReturnDate && !!existingRow?.trip_location && !isCityMatchingHome(existingRow.trip_location, homeAddress) && isDateAfterReturn(date, returnHomeDates, outboundFlightDates)
    const locationFields: Record<string, string | null> = {}
    if (flightCity) {
      locationFields.location_status = 'away'
      locationFields.trip_location = flightCity
    } else if (isReturnDate || shouldClearStaleHomeAway || shouldClearAfterReturn) {
      locationFields.location_status = 'home'
      locationFields.trip_location = null
    }

    const { error: upsertError } = await adminClient
      .from('availability')
      .upsert(
        {
          user_id: userId,
          date,
          ...slotUpdates,
          ...locationFields,
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

  // Also update location for flight dates that might not have busy slots
  for (const [date, city] of flightLocationByDate) {
    if (busySlotsByDate.has(date)) continue // already handled above
    const { error } = await adminClient
      .from('availability')
      .upsert(
        { user_id: userId, date, location_status: 'away', trip_location: city },
        { onConflict: 'user_id,date', ignoreDuplicates: false }
      )
    if (error) console.error('Error upserting flight location for', date, ':', error)
    else updatedCount++
  }

  for (const existingRow of (existingAvailabilityRows || [])) {
    if (busySlotsByDate.has(existingRow.date) || flightLocationByDate.has(existingRow.date)) continue
    const isReturnDate = returnHomeDates.has(existingRow.date)
    const shouldClear = isReturnDate ||
      (existingRow.trip_location && isCityMatchingHome(existingRow.trip_location, homeAddress)) ||
      (existingRow.trip_location && !isCityMatchingHome(existingRow.trip_location, homeAddress) && isDateAfterReturn(existingRow.date, returnHomeDates, outboundFlightDates))
    if (shouldClear) {
      const { error } = await adminClient
        .from('availability')
        .upsert(
          { user_id: userId, date: existingRow.date, location_status: 'home', trip_location: null },
          { onConflict: 'user_id,date', ignoreDuplicates: false }
        )
      if (error) console.error('Error clearing stale location for', existingRow.date, ':', error)
    }
    }
  }

  // ── Sync plans: preserve manually-enriched plans (those with participants or manual edits) ──

  // Collect all source_event_ids from the incoming sync
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
    const timeSlot = getTimeSlot(hour)
    const timeSlotHyphen = timeSlot.replace('_', '-')

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

  // Fetch existing gcal plans for this user
  const { data: existingPlans } = await adminClient
    .from('plans')
    .select('id, source_event_id')
    .eq('user_id', userId)
    .eq('source', 'gcal')

  // Find which existing plans have participants (manually enriched)
  const existingPlanIds = (existingPlans || []).map((p: any) => p.id)
  let enrichedPlanIds = new Set<string>()
  if (existingPlanIds.length > 0) {
    const { data: participantRows } = await adminClient
      .from('plan_participants')
      .select('plan_id')
      .in('plan_id', existingPlanIds)
    enrichedPlanIds = new Set((participantRows || []).map((r: any) => r.plan_id))
  }

  // Build lookup of existing event_id → plan
  const existingByEventId = new Map<string, any>()
  for (const p of (existingPlans || [])) {
    if (p.source_event_id) existingByEventId.set(p.source_event_id, p)
  }

  // Delete plans that are no longer in the calendar AND don't have participants
  const toDelete = (existingPlans || []).filter((p: any) =>
    !incomingEventIds.has(p.source_event_id) && !enrichedPlanIds.has(p.id)
  )
  if (toDelete.length > 0) {
    await adminClient
      .from('plans')
      .delete()
      .in('id', toDelete.map((p: any) => p.id))
  }

  // For plans that still exist in calendar:
  // - If enriched (has participants): skip entirely to preserve manual edits
  // - If exists but not enriched: update in place (preserving ID)
  // - If new: insert
  const toInsert: any[] = []
  for (const [eventId, planRow] of planRowsByEventId) {
    const existing = existingByEventId.get(eventId)
    if (existing) {
      if (enrichedPlanIds.has(existing.id)) {
        // Skip - preserve manual edits and participants
        continue
      }
      // Update existing plan in-place (preserves ID and participants)
      await adminClient
        .from('plans')
        .update({
          title: planRow.title,
          activity: planRow.activity,
          date: planRow.date,
          time_slot: planRow.time_slot,
          start_time: planRow.start_time,
          end_time: planRow.end_time,
        })
        .eq('id', existing.id)
    } else {
      toInsert.push(planRow)
    }
  }

  if (toInsert.length > 0) {
    const { error: plansError } = await adminClient
      .from('plans')
      .insert(toInsert)
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

    // Parse timezone from request body
    let timezone: string | undefined
    try {
      const body = await req.json()
      timezone = body?.timezone
    } catch { /* no body or invalid JSON */ }

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

    // Fetch calendar events for the past 3 months and next 3 months
    const now = new Date()
    const threeMonthsAgo = new Date(now)
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const threeMonthsAhead = new Date(now)
    threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3)
    const timeMin = threeMonthsAgo.toISOString()
    const timeMax = threeMonthsAhead.toISOString()

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

    const { updatedCount } = await handleEventsSync({ adminClient, userId, events, timezone })

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
