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

// ── Airport / Flight Detection (mirrored from google-calendar-sync) ─────────

const AIRPORT_CITY_MAP: Record<string, string> = {
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
  YYZ: 'Toronto', YVR: 'Vancouver', YUL: 'Montreal', YOW: 'Ottawa', YYC: 'Calgary',
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
  DPS: 'Denpasar',
}

function extractFlightDestination(summary?: string): string | null {
  if (!summary) return null
  const upper = summary.toUpperCase()
  const codes = upper.match(/\b([A-Z]{3})\b/g)
  if (codes) {
    const airports = codes.filter(c => c in AIRPORT_CITY_MAP)
    if (airports.length > 0) {
      return AIRPORT_CITY_MAP[airports[airports.length - 1]]
    }
  }
  const flightToMatch = summary.match(/\bflight\s+to\s+([A-Za-z\s]+?)(?:\s*\(|$)/i)
  if (flightToMatch) {
    const city = flightToMatch[1].trim()
    if (city.length >= 3) return city
  }
  return null
}

function isFlightEvent(summary?: string): boolean {
  if (!summary) return false
  const s = summary.toLowerCase()
  if (/\bflight\b/.test(s)) return true
  if (/\b(united|delta|american|southwest|jetblue|alaska|spirit|frontier|british airways|lufthansa|air france|emirates|qatar)\b/.test(s)) return true
  if (/\b[A-Z]{2}\s?\d{1,4}\b/i.test(summary)) {
    const codes = summary.toUpperCase().match(/\b([A-Z]{3})\b/g)
    if (codes?.some(c => c in AIRPORT_CITY_MAP)) return true
  }
  return false
}

function isCityMatchingHome(city: string, homeAddress: string | null): boolean {
  if (!city || !homeAddress) return false
  const normCity = city.toLowerCase().trim()
  const normHome = homeAddress.toLowerCase().trim()
  if (normHome.includes(normCity) || normCity.includes(normHome)) return true
  const homeCity = normHome.split(',')[0].trim().replace(/\s*(city|town|village)$/i, '').trim()
  const flightCity = normCity.replace(/\s*(city|town|village)$/i, '').trim()
  if (homeCity && flightCity && (homeCity.includes(flightCity) || flightCity.includes(homeCity))) return true
  return false
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

    // Fetch user's home address for flight detection
    const { data: profileData } = await adminClient
      .from('profiles')
      .select('home_address')
      .eq('user_id', userId)
      .single()
    const homeAddress: string | null = profileData?.home_address || null

    // ── Update availability ────────────────────────────────────────────────

    const busySlotsByDate: Map<string, Set<string>> = new Map()

    // Flight detection
    interface FlightInfo { date: string; city: string | null; isReturn: boolean }
    const allFlights: FlightInfo[] = []
    const flightLocationByDate: Map<string, string> = new Map()

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

      // Detect flights
      if (isFlightEvent(event.summary)) {
        const city = extractFlightDestination(event.summary)
        const isReturn = city ? isCityMatchingHome(city, homeAddress) : false
        const dateStr = getDateString(event.dtstart, timezone)
        allFlights.push({ date: dateStr, city, isReturn })
        if (city && !isReturn) {
          flightLocationByDate.set(dateStr, city)
        }
      }
    }

    // Sort flights and fill gap days
    allFlights.sort((a, b) => a.date.localeCompare(b.date))
    const allFlightDatesSet = new Set(allFlights.map(f => f.date))
    const outboundEntries = Array.from(flightLocationByDate.entries()).sort(([a], [b]) => a.localeCompare(b))
    for (const [outDate, city] of outboundEntries) {
      const current = new Date(outDate)
      current.setDate(current.getDate() + 1)
      for (let i = 0; i < 30; i++) {
        const dateStr = current.toISOString().split('T')[0]
        if (allFlightDatesSet.has(dateStr)) break
        flightLocationByDate.set(dateStr, city)
        current.setDate(current.getDate() + 1)
      }
    }

    // Fetch existing availability for stale-away cleanup
    const syncRangeStart = getDateString(rangeStart, timezone)
    const syncRangeEnd = getDateString(rangeEnd, timezone)
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

      const flightCity = flightLocationByDate.get(date)
      const existingRow = existingAvailabilityByDate.get(date)
      const shouldClearStaleHomeAway = !flightCity && !!existingRow?.trip_location && isCityMatchingHome(existingRow.trip_location, homeAddress)
      const locationFields: Record<string, string | null> = {}
      if (flightCity) {
        locationFields.location_status = 'away'
        locationFields.trip_location = flightCity
      } else if (shouldClearStaleHomeAway) {
        locationFields.location_status = 'home'
        locationFields.trip_location = null
      }

      const { error: upsertError } = await adminClient
        .from('availability')
        .upsert(
          { user_id: userId, date, ...slotUpdates, ...locationFields },
          { onConflict: 'user_id,date', ignoreDuplicates: false }
        )

      if (upsertError) {
        console.error('Error upserting availability for', date, ':', upsertError)
      } else {
        updatedCount++
      }
    }

    // Update location for flight dates without busy slots
    for (const [date, city] of flightLocationByDate) {
      if (busySlotsByDate.has(date)) continue
      const { error } = await adminClient
        .from('availability')
        .upsert(
          { user_id: userId, date, location_status: 'away', trip_location: city },
          { onConflict: 'user_id,date', ignoreDuplicates: false }
        )
      if (error) console.error('Error upserting flight location for', date, ':', error)
      else updatedCount++
    }

    // Clean stale home-city away statuses
    for (const existingRow of (existingAvailabilityRows || [])) {
      if (busySlotsByDate.has(existingRow.date) || flightLocationByDate.has(existingRow.date)) continue
      if (existingRow.trip_location && isCityMatchingHome(existingRow.trip_location, homeAddress)) {
        await adminClient.from('availability').upsert(
          { user_id: userId, date: existingRow.date, location_status: 'home', trip_location: null },
          { onConflict: 'user_id,date', ignoreDuplicates: false }
        )
      }
    }

    // ── Sync plans: preserve manually-enriched plans ──────────────────────

    // Build incoming plan data keyed by source_event_id (uid)
    const incomingEventIds = new Set<string>()
    const planRowsByEventId = new Map<string, any>()

    for (const event of events) {
      const hour = event.isAllDay ? 8 : getHourInTimezone(event.dtstart, timezone)
      const timeSlot = getTimeSlot(hour).replace('_', '-')
      const localDateStr = getDateString(event.dtstart, timezone)
      const planDate = `${localDateStr}T12:00:00+00:00`
      const startTimeStr = event.isAllDay ? null : formatTimeHHMM(event.dtstart, timezone)
      const endTimeStr = event.isAllDay ? null : formatTimeHHMM(event.dtend, timezone)

      incomingEventIds.add(event.uid)
      planRowsByEventId.set(event.uid, {
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

    // Fetch existing ical plans
    const { data: existingPlans } = await adminClient
      .from('plans')
      .select('id, source_event_id')
      .eq('user_id', userId)
      .eq('source', 'ical')

    // Find which have participants (manually enriched)
    const existingPlanIds = (existingPlans || []).map((p: any) => p.id)
    let enrichedPlanIds = new Set<string>()
    if (existingPlanIds.length > 0) {
      const { data: participantRows } = await adminClient
        .from('plan_participants')
        .select('plan_id')
        .in('plan_id', existingPlanIds)
      enrichedPlanIds = new Set((participantRows || []).map((r: any) => r.plan_id))
    }

    const existingByEventId = new Map<string, any>()
    for (const p of (existingPlans || [])) {
      if (p.source_event_id) existingByEventId.set(p.source_event_id, p)
    }

    // Delete plans no longer in calendar and not enriched
    const toDelete = (existingPlans || []).filter((p: any) =>
      !incomingEventIds.has(p.source_event_id) && !enrichedPlanIds.has(p.id)
    )
    if (toDelete.length > 0) {
      await adminClient
        .from('plans')
        .delete()
        .in('id', toDelete.map((p: any) => p.id))
    }

    // Upsert: skip enriched, update existing, insert new
    const toInsert: any[] = []
    for (const [eventId, planRow] of planRowsByEventId) {
      const existing = existingByEventId.get(eventId)
      if (existing) {
        if (enrichedPlanIds.has(existing.id)) continue
        await adminClient
          .from('plans')
          .update({
            title: planRow.title,
            activity: planRow.activity,
            date: planRow.date,
            time_slot: planRow.time_slot,
            location: planRow.location,
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
