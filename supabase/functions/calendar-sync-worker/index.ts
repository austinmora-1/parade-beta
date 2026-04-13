import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Shared helpers (mirrored from google-calendar-sync & ical-sync) ─────────

function getTimeSlot(hour: number): string {
  if (hour >= 2 && hour < 9) return 'early_morning'
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
    slots.add(getTimeSlot(getHourInTimezone(current, timezone)))
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
    if (!seen.has(d)) { seen.add(d); dates.push(d) }
    current.setTime(current.getTime() + 60 * 60 * 1000)
  }
  return dates
}

function normalizePlanTitle(title?: string): string {
  if (!title) return ''
  let t = title.toLowerCase().trim()
  t = t.replace(/^flight\s*(\d+\s*of\s*\d+\s*\|?\s*)?/i, '')
  t = t.replace(/\|/g, ' ')
  t = t.replace(/([a-z]{2})0+(\d)/gi, '$1$2')
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

// Check if a normalized title looks like a flight (contains 2+ known airport codes)
function isFlightTitle(normalizedTitle: string): boolean {
  const upper = normalizedTitle.toUpperCase()
  const codes = upper.match(/\b([A-Z]{3})\b/g)
  if (!codes) return false
  return codes.filter(c => c in AIRPORT_CITY_MAP).length >= 2
}

// Extract YYYY-MM-DD from any date format (ISO string, Postgres timestamptz, etc.)
function extractDateOnly(date: string): string {
  return date.replace(/^(\d{4}-\d{2}-\d{2}).*/, '$1')
}

// Build content dedup key: for flights, ignore start_time to catch all-day vs timed mismatches
function makeContentKey(normalizedTitle: string, date: string, startTime: string | null): string {
  const d = extractDateOnly(date)
  if (isFlightTitle(normalizedTitle)) {
    return `${normalizedTitle}|${d}`
  }
  return `${normalizedTitle}|${d}|${startTime || ''}`
}

function classifyActivity(summary?: string): string {
  if (!summary) return 'hanging-out'
  const s = summary.toLowerCase()

  // ── Flights (keep first — used for trip detection) ──
  if (/\bflight\b/.test(s)) return 'flight'

  // ── Hotels / Accommodation ──
  if (/\b(hotel|airbnb|vrbo|booking|reservation|check[\s-]?in|check[\s-]?out|stay\s+at|lodging|accommodation|marriott|hilton|hyatt|sheraton|westin|holiday\s*inn|hampton|doubletree|courtyard|residence\s*inn|ritz|four\s*seasons|intercontinental|radisson|best\s*western|comfort\s*inn|la\s*quinta|motel|hostel)\b/i.test(s)) return 'hotel'

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
  // General fitness catch-all
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

// Airport codes for flight detection
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
  ABQ: 'Albuquerque', ANC: 'Anchorage', BDL: 'Hartford', BHM: 'Birmingham', BOI: 'Boise',
  BUF: 'Buffalo', CHS: 'Charleston', CLE: 'Cleveland', CMH: 'Columbus', CVG: 'Cincinnati',
  YYZ: 'Toronto', YVR: 'Vancouver', YUL: 'Montreal', YOW: 'Ottawa', YYC: 'Calgary',
  LHR: 'London', LGW: 'London', CDG: 'Paris', ORY: 'Paris', FCO: 'Rome', AMS: 'Amsterdam',
  FRA: 'Frankfurt', MUC: 'Munich', MAD: 'Madrid', BCN: 'Barcelona', LIS: 'Lisbon',
  DUB: 'Dublin', ZRH: 'Zurich', CPH: 'Copenhagen', ATH: 'Athens', IST: 'Istanbul',
  MRS: 'Marseille', NCE: 'Nice', BER: 'Berlin', MXP: 'Milan', PRG: 'Prague', BUD: 'Budapest',
  CHQ: 'Chania', HER: 'Heraklion', SPU: 'Split', DBV: 'Dubrovnik', EDI: 'Edinburgh',
  NRT: 'Tokyo', HND: 'Tokyo', KIX: 'Osaka', ICN: 'Seoul', PEK: 'Beijing', PVG: 'Shanghai',
  HKG: 'Hong Kong', SIN: 'Singapore', BKK: 'Bangkok', SYD: 'Sydney', MEL: 'Melbourne',
  AKL: 'Auckland', DEL: 'Delhi', BOM: 'Mumbai', DXB: 'Dubai', DOH: 'Doha',
  GRU: 'São Paulo', EZE: 'Buenos Aires', MEX: 'Mexico City', CUN: 'Cancún',
  GDL: 'Guadalajara', BOG: 'Bogotá', LIM: 'Lima', SCL: 'Santiago',
  JNB: 'Johannesburg', CAI: 'Cairo', NBO: 'Nairobi', CPT: 'Cape Town',
  DPS: 'Denpasar', KUL: 'Kuala Lumpur', MNL: 'Manila',
}

function resolveToCity(location: string | null | undefined): string | null {
  if (!location || !location.trim()) return null
  const trimmed = location.trim()
  const upper = trimmed.toUpperCase()
  if (/^[A-Z]{3}$/.test(upper) && upper in AIRPORT_CITY_MAP) {
    return AIRPORT_CITY_MAP[upper]
  }
  if (trimmed.length <= 4 && upper in AIRPORT_CITY_MAP) return AIRPORT_CITY_MAP[upper]
  return trimmed
}

function isFlightEvent(summary?: string): boolean {
  if (!summary) return false
  const s = summary.toLowerCase()
  if (/\bflight\b/.test(s)) return true
  if (/\b(united|delta|american|southwest|jetblue|alaska|spirit)\b/.test(s)) return true
  return false
}

function extractFlightDestination(summary?: string): string | null {
  if (!summary) return null
  const codes = summary.toUpperCase().match(/\b([A-Z]{3})\b/g)
  if (codes) {
    const airports = codes.filter(c => c in AIRPORT_CITY_MAP)
    if (airports.length > 0) return AIRPORT_CITY_MAP[airports[airports.length - 1]]
  }
  // Fallback: match "Flight to <City>" pattern
  const flightToMatch = summary.match(/\bflight\s+to\s+([A-Za-z\s]+?)(?:\s*\(|$)/i)
  if (flightToMatch) {
    const city = flightToMatch[1].trim()
    if (city.length >= 3) return city
  }
  return null
}

// Check if a city name matches a home address
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

function normalizeLocation(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/\s*(city|town|village)$/i, '')
    .trim()
}

function isLocationMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalizedA = normalizeLocation(a)
  const normalizedB = normalizeLocation(b)
  if (!normalizedA || !normalizedB) return false
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true

  const cityA = normalizedA.split(',')[0]?.trim()
  const cityB = normalizedB.split(',')[0]?.trim()
  return !!cityA && !!cityB && (cityA.includes(cityB) || cityB.includes(cityA))
}

// ── Hotel / Reservation Detection ───────────────────────────────────────────

const HOTEL_REGEX = /\b(hotel|airbnb|vrbo|booking|reservation|check[\s-]?in|check[\s-]?out|stay\s+at|lodging|accommodation|marriott|hilton|hyatt|sheraton|westin|holiday\s*inn|hampton|doubletree|courtyard|residence\s*inn|ritz|four\s*seasons|intercontinental|radisson|best\s*western|comfort\s*inn|la\s*quinta|motel|hostel|inn\b|lodge\b)\b/i

function isHotelEvent(summary?: string, location?: string): boolean {
  if (!summary) return false
  if (HOTEL_REGEX.test(summary)) return true
  if (location && HOTEL_REGEX.test(location)) return true
  return false
}

function stripHotelBrands(text: string): string {
  return text
    .replace(/\b(residence\s*inn|courtyard|marriott|hilton|hyatt|sheraton|westin|holiday\s*inn|hampton|doubletree|ritz|four\s*seasons|intercontinental|radisson|best\s*western|comfort\s*inn|la\s*quinta|airbnb|vrbo|hotel|motel|hostel|inn|lodge|resort|suites?|stay\s+at)\b/gi, '')
    .replace(/\bby\s+(marriott|hilton|hyatt|wyndham|ihg|accor|choice)\b/gi, '')
    .replace(/^\s*by\s+/i, '')
    .replace(/\s[-–—]\s/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function extractHotelLocation(summary?: string, location?: string): string | null {
  if (location && location.trim().length > 0) {
    const parts = location.split(',').map(p => p.trim())
    if (parts.length >= 3) {
      const city = stripHotelBrands(parts[parts.length - 2])
      if (city.length >= 2) return city
    }
    if (parts.length === 2) {
      const stripped = stripHotelBrands(parts[0])
      if (stripped.length >= 2 && !HOTEL_REGEX.test(stripped)) return stripped
      const stripped2 = stripHotelBrands(parts[1])
      if (stripped2.length >= 2) return stripped2
      return parts[0]
    }
    const stripped = stripHotelBrands(location.trim())
    if (stripped.length >= 2 && !HOTEL_REGEX.test(stripped)) return stripped
    return null
  }
  const inMatch = summary?.match(/\b(?:in|at)\s+([A-Z][A-Za-z\s]+?)(?:\s*[-–—]|\s*\(|$)/i)
  if (inMatch) {
    const city = stripHotelBrands(inMatch[1].trim())
    if (city.length >= 3 && !HOTEL_REGEX.test(city)) return city
  }
  return null
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

// Check if a date falls after a return-home flight but before the next outbound flight
function isDateAfterReturn(dateStr: string, returnDates: Set<string>, outboundDates: Set<string>): boolean {
  let latestReturn: string | null = null
  for (const rd of returnDates) {
    if (rd <= dateStr && (!latestReturn || rd > latestReturn)) latestReturn = rd
  }
  if (!latestReturn) return false
  for (const od of outboundDates) {
    if (od > latestReturn && od <= dateStr) return false
  }
  return true
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
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  let inEvent = false, uid = '', summary = '', dtstart: Date | null = null, dtend: Date | null = null, isAllDay = false, location = ''

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; uid = ''; summary = ''; dtstart = null; dtend = null; isAllDay = false; location = ''; continue }
    if (line === 'END:VEVENT') {
      inEvent = false
      if (dtstart && dtend && dtend > rangeStart && dtstart < rangeEnd) {
        events.push({ uid, summary, dtstart, dtend, isAllDay, location: location || undefined })
      }
      continue
    }
    if (!inEvent) continue
    if (line.startsWith('UID:')) uid = line.slice(4)
    else if (line.startsWith('SUMMARY:')) summary = line.slice(8).replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
    else if (line.startsWith('LOCATION:')) location = line.slice(9).replace(/\\n/g, '\n').replace(/\\,/g, ',')
    else if (line.startsWith('DTSTART')) { const p = parseICSDate(line); if (p) { dtstart = p.date; isAllDay = p.allDay } }
    else if (line.startsWith('DTEND')) { const p = parseICSDate(line); if (p) dtend = p.date }
  }
  return events
}

function parseICSDate(line: string): { date: Date; allDay: boolean } | null {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null
  const params = line.slice(0, colonIdx)
  const value = line.slice(colonIdx + 1).trim()
  const allDay = params.includes('VALUE=DATE') && !params.includes('VALUE=DATE-TIME')
  if (allDay) {
    return { date: new Date(Date.UTC(parseInt(value.slice(0, 4)), parseInt(value.slice(4, 6)) - 1, parseInt(value.slice(6, 8)))), allDay: true }
  }
  const y = parseInt(value.slice(0, 4)), m = parseInt(value.slice(4, 6)) - 1, d = parseInt(value.slice(6, 8))
  const h = parseInt(value.slice(9, 11)), min = parseInt(value.slice(11, 13)), s = parseInt(value.slice(13, 15)) || 0
  if (value.endsWith('Z')) return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false }
  return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false }
}

// Format a Date to HH:MM in the given timezone
function formatTimeHHMM(date: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
  if (timezone) opts.timeZone = timezone
  return new Intl.DateTimeFormat('en-GB', opts).format(date)
}

async function syncGoogleCalendar(adminClient: any, userId: string): Promise<{ eventsProcessed: number; datesUpdated: number }> {
  const { data: connRows, error: connError } = await adminClient
    .from('calendar_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')

  if (connError || !connRows || connRows.length === 0) {
    throw new Error('Google Calendar not connected')
  }

  // Fetch user's profile for home address and timezone inference
  const { data: profileData } = await adminClient
    .from('profiles')
    .select('home_address, timezone')
    .eq('user_id', userId)
    .single()
  const homeAddress: string | null = profileData?.home_address || null

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

  const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  calendarUrl.searchParams.set('timeMin', threeMonthsAgo.toISOString())
  calendarUrl.searchParams.set('timeMax', threeMonthsAhead.toISOString())
  calendarUrl.searchParams.set('maxResults', '250')
  calendarUrl.searchParams.set('singleEvents', 'true')
  calendarUrl.searchParams.set('orderBy', 'startTime')

  const calendarResponse = await fetch(calendarUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!calendarResponse.ok) {
    throw new Error(`Google Calendar API error: ${calendarResponse.status}`)
  }

  const calendarData = await calendarResponse.json()
  const events: GCalEvent[] = calendarData.items || []

  // Infer timezone from first event with dateTime (Google includes TZ offset in dateTime)
  let timezone: string | undefined
  for (const event of events) {
    if (event.start.dateTime) {
      // Google Calendar API returns dateTime with timezone info — try to extract
      // We use the calendar's timeZone if available, otherwise fall back to America/New_York
      break
    }
  }
  // Use calendar timeZone from response if available
  if (calendarData.timeZone) {
    timezone = calendarData.timeZone
  }

  // Process events into availability
  const busySlotsByDate: Map<string, Set<string>> = new Map()
  interface FlightInfo { date: string; timestamp: number; city: string | null; isReturn: boolean }
  const allFlights: FlightInfo[] = []
  interface HotelStay { startDate: string; endDate: string; city: string }
  const hotelStays: HotelStay[] = []

  for (const event of events) {
    if (!event.start.dateTime || !event.end.dateTime) {
      if (event.start.date && event.end.date) {
        const startDate = new Date(event.start.date)
        const endDate = new Date(event.end.date); endDate.setDate(endDate.getDate() - 1)
        const dates = getEventDates(startDate, endDate, timezone)
        for (const date of dates) {
          if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
          ;['early_morning', 'late_morning', 'early_afternoon', 'late_afternoon', 'evening', 'late_night'].forEach(s => busySlotsByDate.get(date)!.add(s))
        }
        // Check all-day hotel events
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

  // Sort flights chronologically by actual departure time (critical for connecting flights)
  allFlights.sort((a, b) => a.timestamp - b.timestamp)

  // Build flightLocationByDate: for same-day connecting flights, last leg wins
  const flightLocationByDate: Map<string, string> = new Map()
  for (const flight of allFlights) {
    if (flight.city && !flight.isReturn) {
      flightLocationByDate.set(flight.date, flight.city)
    }
  }

  const allFlightDatesSet = new Set(allFlights.map(f => f.date))

  const { data: existingTrips } = await adminClient
    .from('trips')
    .select('id, location, start_date, end_date, needs_return_date')
    .eq('user_id', userId)

  // Determine return vs outbound per day based on LAST flight of each day
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

  // Fill gap days with one-way flight detection (7 days instead of 30)
  const outboundEntries = Array.from(flightLocationByDate.entries()).sort(([a], [b]) => a.localeCompare(b))
  for (const [outDate, city] of outboundEntries) {
    let hasReturn = false
    const maxReturnDate = new Date(outDate + 'T00:00:00Z'); maxReturnDate.setDate(maxReturnDate.getDate() + 30)
    const maxReturnStr = maxReturnDate.toISOString().split('T')[0]
    for (const rf of allFlights) {
      if (rf.date > outDate && rf.date <= maxReturnStr && (rf.isReturn || (!rf.isReturn && rf.city && rf.city !== city))) { hasReturn = true; break }
    }
    const fillLimit = hasReturn ? 30 : 7
    const current = new Date(outDate)
    current.setDate(current.getDate() + 1)
    for (let i = 0; i < fillLimit; i++) {
      const dateStr = current.toISOString().split('T')[0]
      if (allFlightDatesSet.has(dateStr)) break
      flightLocationByDate.set(dateStr, city)
      current.setDate(current.getDate() + 1)
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
    const { error } = await adminClient.from('availability').upsert({ user_id: userId, date, ...slotUpdates, ...locationFields }, { onConflict: 'user_id,date', ignoreDuplicates: false })
    if (!error) updatedCount++
  }

  // Also update dates that have location data but no busy slots
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

  // Flag one-way trips (needs_return_date)
  const pendingReturnTrips: { city: string; departureDate: string }[] = []
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
      if (rf.date > outDate && rf.date <= maxReturnStr && (rf.isReturn || (!rf.isReturn && rf.city && rf.city !== city))) { hasReturn = true; break }
    }
    if (!hasReturn) pendingReturnTrips.push({ city, departureDate: outDate })
  }
  // Merge overlapping trips with same destination
  await adminClient.rpc('merge_overlapping_trips', { p_user_id: userId })

  if (pendingReturnTrips.length > 0) {
    for (const prt of pendingReturnTrips) {
      await adminClient.from('trips').update({ needs_return_date: true })
        .eq('user_id', userId)
        .eq('location', prt.city)
        .gte('start_date', prt.departureDate)
    }
  }

  // ── Smart plan reconciliation: preserve manually-enriched plans (those with participants) ──

  // Build incoming plan data by event ID
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
    const localDateStr = getDateString(startDate, timezone)
    const planDate = `${localDateStr}T12:00:00+00:00`
    const startTimeStr = event.start.dateTime ? formatTimeHHMM(new Date(event.start.dateTime), timezone) : null
    const endTimeStr = event.end.dateTime ? formatTimeHHMM(new Date(event.end.dateTime), timezone) : null

    incomingEventIds.add(event.id)
    planRowsByEventId.set(event.id, {
      user_id: userId,
      title: event.summary || 'Gcal imported event',
      activity: classifyActivity(event.summary),
      date: planDate,
      time_slot: timeSlotHyphen,
      duration: 1,
      source: 'gcal',
      source_event_id: event.id,
      start_time: startTimeStr,
      end_time: endTimeStr,
      source_timezone: timezone || null,
    })
  }

  // Fetch existing gcal plans for this user
  const { data: existingPlans } = await adminClient
    .from('plans')
    .select('id, source_event_id, title, date, start_time, manually_edited')
    .eq('user_id', userId)
    .eq('source', 'gcal')

  // Also fetch ALL plans for content-based dedup
  const { data: allUserPlans } = await adminClient
    .from('plans')
    .select('id, source, source_event_id, title, date, start_time, manually_edited')
    .eq('user_id', userId)

  const contentLookup = new Map<string, any>()
  for (const p of (allUserPlans || [])) {
    const nt = normalizePlanTitle(p.title)
    const key = makeContentKey(nt, p.date, p.start_time)
    if (!contentLookup.has(key)) contentLookup.set(key, p)
  }

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

  // Delete plans that are no longer in the calendar AND not enriched AND not manually edited
  const toDelete = (existingPlans || []).filter((p: any) =>
    !incomingEventIds.has(p.source_event_id) && !enrichedPlanIds.has(p.id) && !p.manually_edited
  )
  if (toDelete.length > 0) {
    await adminClient
      .from('plans')
      .delete()
      .in('id', toDelete.map((p: any) => p.id))
  }

  const toInsert: any[] = []
  for (const [eventId, planRow] of planRowsByEventId) {
    const existing = existingByEventId.get(eventId)
    if (existing) {
      if (enrichedPlanIds.has(existing.id) || existing.manually_edited) {
        continue // Skip - preserve manual edits and participants
      }
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
      // Content-based dedup
      const nt = normalizePlanTitle(planRow.title)
      const contentKey = makeContentKey(nt, planRow.date, planRow.start_time)
      const contentMatch = contentLookup.get(contentKey)
      if (contentMatch) {
        const mergeFields: Record<string, any> = {}
        if (!contentMatch.source_event_id || contentMatch.source === 'gcal') {
          mergeFields.source = 'gcal'
          mergeFields.source_event_id = eventId
        }
        if (!contentMatch.start_time && planRow.start_time) {
          mergeFields.start_time = planRow.start_time
          mergeFields.end_time = planRow.end_time
        }
        if (Object.keys(mergeFields).length > 0) {
          await adminClient.from('plans').update(mergeFields).eq('id', contentMatch.id)
        }
        console.log(`[DEDUP] Skipped duplicate: "${planRow.title}" on ${planRow.date}`)
      } else {
        toInsert.push(planRow)
        contentLookup.set(contentKey, planRow)
      }
    }
  }

  if (toInsert.length > 0) {
    const { error: plansError } = await adminClient
      .from('plans')
      .insert(toInsert)
    if (plansError) {
      if (plansError.code === '23505') {
        for (const row of toInsert) {
          const { error: singleErr } = await adminClient.from('plans').insert(row)
          if (singleErr && singleErr.code !== '23505') console.error('Error inserting plan:', singleErr)
        }
      } else {
        console.error('Error inserting gcal plans:', plansError)
      }
    }
  }

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

  // Fetch profile for timezone
  const { data: profileData } = await adminClient
    .from('profiles')
    .select('timezone')
    .eq('user_id', userId)
    .single()

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
  for (const event of events) {
    if (event.isAllDay) {
      const endExclusive = new Date(event.dtend); endExclusive.setDate(endExclusive.getDate() - 1)
      for (const date of getEventDates(event.dtstart, endExclusive)) {
        if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
        ;['early_morning', 'late_morning', 'early_afternoon', 'late_afternoon', 'evening', 'late_night'].forEach(s => busySlotsByDate.get(date)!.add(s))
      }
      continue
    }
    for (const date of getEventDates(event.dtstart, event.dtend)) {
      if (!busySlotsByDate.has(date)) busySlotsByDate.set(date, new Set())
      getEventTimeSlots(event.dtstart, event.dtend).forEach(s => busySlotsByDate.get(date)!.add(s))
    }
  }

  let updatedCount = 0
  for (const [date, slots] of busySlotsByDate) {
    const slotUpdates: Record<string, boolean> = {}
    for (const slot of slots) slotUpdates[slot] = false
    const { error } = await adminClient.from('availability').upsert({ user_id: userId, date, ...slotUpdates }, { onConflict: 'user_id,date', ignoreDuplicates: false })
    if (!error) updatedCount++
  }

  // ── Smart plan reconciliation for iCal (same pattern as gcal) ──
  const incomingEventIds = new Set<string>()
  const planRowsByEventId = new Map<string, any>()

  for (const event of events) {
    const hour = event.isAllDay ? 8 : event.dtstart.getUTCHours()
    const localDateStr = getDateString(event.dtstart)
    incomingEventIds.add(event.uid)
    const icalStartTime = !event.isAllDay ? formatTimeHHMM(event.dtstart, profileData?.timezone) : null
    const icalEndTime = !event.isAllDay && event.dtend ? formatTimeHHMM(event.dtend, profileData?.timezone) : null
    planRowsByEventId.set(event.uid, {
      user_id: userId, title: (event.summary || 'iCal imported event').replace(/\s+/g, ' ').trim(),
      activity: classifyActivity(event.summary), date: `${localDateStr}T12:00:00+00:00`,
      time_slot: getTimeSlot(hour).replace('_', '-'), duration: 1,
      location: event.location || null, source: 'ical', source_event_id: event.uid,
      source_timezone: profileData?.timezone || null,
      start_time: icalStartTime,
      end_time: icalEndTime,
    })
  }

  // Fetch existing ical plans
  const { data: existingPlans } = await adminClient
    .from('plans')
    .select('id, source_event_id, title, date, start_time')
    .eq('user_id', userId)
    .eq('source', 'ical')

  // Also fetch ALL plans for content-based dedup
  const { data: allUserPlansIcal } = await adminClient
    .from('plans')
    .select('id, source, source_event_id, title, date, start_time')
    .eq('user_id', userId)

  const contentLookupIcal = new Map<string, any>()
  for (const p of (allUserPlansIcal || [])) {
    const nt = normalizePlanTitle(p.title)
    const key = makeContentKey(nt, p.date, p.start_time)
    if (!contentLookupIcal.has(key)) contentLookupIcal.set(key, p)
  }

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

  // Delete plans no longer in calendar AND not enriched
  const toDelete = (existingPlans || []).filter((p: any) =>
    !incomingEventIds.has(p.source_event_id) && !enrichedPlanIds.has(p.id)
  )
  if (toDelete.length > 0) {
    await adminClient.from('plans').delete().in('id', toDelete.map((p: any) => p.id))
  }

  const toInsert: any[] = []
  for (const [eventId, planRow] of planRowsByEventId) {
    const existing = existingByEventId.get(eventId)
    if (existing) {
      if (enrichedPlanIds.has(existing.id)) continue
      await adminClient.from('plans').update({
        title: planRow.title, activity: planRow.activity,
        date: planRow.date, time_slot: planRow.time_slot,
      }).eq('id', existing.id)
    } else {
      // Content-based dedup
      const nt = normalizePlanTitle(planRow.title)
      const contentKey = makeContentKey(nt, planRow.date, planRow.start_time)
      const contentMatch = contentLookupIcal.get(contentKey)
      if (contentMatch) {
        const mergeFields: Record<string, any> = {}
        if (!contentMatch.source_event_id || contentMatch.source === 'ical') {
          mergeFields.source = 'ical'
          mergeFields.source_event_id = eventId
        }
        if (!contentMatch.start_time && planRow.start_time) {
          mergeFields.start_time = planRow.start_time
          mergeFields.end_time = planRow.end_time
        }
        if (Object.keys(mergeFields).length > 0) {
          await adminClient.from('plans').update(mergeFields).eq('id', contentMatch.id)
        }
        console.log(`[DEDUP] Skipped duplicate: "${planRow.title}" on ${planRow.date}`)
      } else {
        toInsert.push(planRow)
        contentLookupIcal.set(contentKey, planRow)
      }
    }
  }
  if (toInsert.length > 0) {
    const { error: insertErr } = await adminClient
      .from('plans')
      .insert(toInsert)
    if (insertErr) {
      if (insertErr.code === '23505') {
        for (const row of toInsert) {
          const { error: singleErr } = await adminClient.from('plans').insert(row)
          if (singleErr && singleErr.code !== '23505') console.error('Error inserting plan:', singleErr)
        }
      } else {
        console.error('Error inserting ical plans:', insertErr)
      }
    }
  }

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
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
