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
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null

  const params = line.slice(0, colonIdx)
  const value = line.slice(colonIdx + 1).trim()

  const allDay = params.includes('VALUE=DATE') && !params.includes('VALUE=DATE-TIME')

  if (allDay) {
    const y = parseInt(value.slice(0, 4))
    const m = parseInt(value.slice(4, 6)) - 1
    const d = parseInt(value.slice(6, 8))
    return { date: new Date(Date.UTC(y, m, d)), allDay: true }
  }

  const y = parseInt(value.slice(0, 4))
  const m = parseInt(value.slice(4, 6)) - 1
  const d = parseInt(value.slice(6, 8))
  const h = parseInt(value.slice(9, 11))
  const min = parseInt(value.slice(11, 13))
  const s = parseInt(value.slice(13, 15)) || 0

  if (value.endsWith('Z')) {
    return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false }
  }

  const tzidMatch = params.match(/TZID=([^;:]+)/)
  const tzid = tzidMatch ? tzidMatch[1] : undefined

  if (tzid) {
    try {
      const guess = new Date(Date.UTC(y, m, d, h, min, s))
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tzid,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      })
      const parts = formatter.formatToParts(guess)
      const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')
      const tzHour = getPart('hour') === 24 ? 0 : getPart('hour')

      const localAsUtc = new Date(Date.UTC(
        getPart('year'), getPart('month') - 1, getPart('day'),
        tzHour, getPart('minute'), getPart('second')
      ))

      const offsetMs = localAsUtc.getTime() - guess.getTime()
      const correctedUtc = new Date(guess.getTime() - offsetMs)

      return { date: correctedUtc, allDay: false }
    } catch {
      return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false }
    }
  }

  return { date: new Date(Date.UTC(y, m, d, h, min, s)), allDay: false }
}

// ── Airport / Flight Detection ─────────────────────────────────────────────

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
  DAL: 'Dallas', DSM: 'Des Moines', ELP: 'El Paso', GRR: 'Grand Rapids', GSP: 'Greenville',
  ICT: 'Wichita', LIT: 'Little Rock', MEM: 'Memphis', MHT: 'Manchester', MSN: 'Madison',
  OKC: 'Oklahoma City', PBI: 'West Palm Beach', PVD: 'Providence', RIC: 'Richmond',
  ROC: 'Rochester', RSW: 'Fort Myers', SDF: 'Louisville', SRQ: 'Sarasota', SYR: 'Syracuse',
  TUL: 'Tulsa', TUS: 'Tucson',
  YYZ: 'Toronto', YVR: 'Vancouver', YUL: 'Montreal', YOW: 'Ottawa', YYC: 'Calgary',
  YEG: 'Edmonton', YHZ: 'Halifax', YWG: 'Winnipeg',
  LHR: 'London', LGW: 'London', STN: 'London', LTN: 'London', CDG: 'Paris', ORY: 'Paris',
  FCO: 'Rome', CIA: 'Rome', AMS: 'Amsterdam', FRA: 'Frankfurt', MUC: 'Munich',
  MAD: 'Madrid', BCN: 'Barcelona', LIS: 'Lisbon', OPO: 'Porto', DUB: 'Dublin',
  ZRH: 'Zurich', GVA: 'Geneva', CPH: 'Copenhagen', ARN: 'Stockholm', OSL: 'Oslo',
  HEL: 'Helsinki', VIE: 'Vienna', BRU: 'Brussels', ATH: 'Athens', IST: 'Istanbul',
  SAW: 'Istanbul', MRS: 'Marseille', NCE: 'Nice', LYS: 'Lyon', TLS: 'Toulouse',
  BER: 'Berlin', TXL: 'Berlin', SXF: 'Berlin', HAM: 'Hamburg', DUS: 'Düsseldorf',
  CGN: 'Cologne', MXP: 'Milan', LIN: 'Milan', NAP: 'Naples', VCE: 'Venice',
  FLR: 'Florence', PMI: 'Palma de Mallorca', AGP: 'Málaga', ALC: 'Alicante',
  VLC: 'Valencia', SVQ: 'Seville', BIO: 'Bilbao', EDI: 'Edinburgh', MAN: 'Manchester',
  BHX: 'Birmingham', GLA: 'Glasgow', PRG: 'Prague', BUD: 'Budapest', WAW: 'Warsaw',
  KRK: 'Krakow', OTP: 'Bucharest', SOF: 'Sofia', ZAG: 'Zagreb', BEG: 'Belgrade',
  TIA: 'Tirana', SKG: 'Thessaloniki', CHQ: 'Chania', HER: 'Heraklion', RHO: 'Rhodes',
  JTR: 'Santorini', MYK: 'Mykonos', SPU: 'Split', DBV: 'Dubrovnik',
  NRT: 'Tokyo', HND: 'Tokyo', KIX: 'Osaka', ICN: 'Seoul', PEK: 'Beijing', PVG: 'Shanghai',
  HKG: 'Hong Kong', SIN: 'Singapore', BKK: 'Bangkok', SYD: 'Sydney', MEL: 'Melbourne',
  BNE: 'Brisbane', PER: 'Perth', AKL: 'Auckland', DEL: 'Delhi', BOM: 'Mumbai',
  BLR: 'Bangalore', MAA: 'Chennai', CCU: 'Kolkata', DXB: 'Dubai', AUH: 'Abu Dhabi',
  DOH: 'Doha', RUH: 'Riyadh', JED: 'Jeddah', TLV: 'Tel Aviv',
  GRU: 'São Paulo', GIG: 'Rio de Janeiro', EZE: 'Buenos Aires', MEX: 'Mexico City',
  CUN: 'Cancún', GDL: 'Guadalajara', SJO: 'San José', PTY: 'Panama City',
  BOG: 'Bogotá', MDE: 'Medellín', LIM: 'Lima', SCL: 'Santiago', MVD: 'Montevideo',
  JNB: 'Johannesburg', CAI: 'Cairo', NBO: 'Nairobi', CPT: 'Cape Town',
  CMN: 'Casablanca', ADD: 'Addis Ababa', LOS: 'Lagos', ACC: 'Accra',
  DPS: 'Denpasar', KUL: 'Kuala Lumpur', MNL: 'Manila', SGN: 'Ho Chi Minh City',
  HAN: 'Hanoi', PNH: 'Phnom Penh', RGN: 'Yangon', CMB: 'Colombo',
}

// Resolve a location to a full city name — catches raw airport codes stored as trip locations
function resolveToCity(location: string | null | undefined): string | null {
  if (!location || !location.trim()) return null
  const trimmed = location.trim()
  // If it's a raw 3-letter uppercase code, look it up
  const upper = trimmed.toUpperCase()
  if (/^[A-Z]{3}$/.test(upper) && upper in AIRPORT_CITY_MAP) {
    return AIRPORT_CITY_MAP[upper]
  }
  // If it looks like it could be an abbreviation embedded in a longer string, try to resolve
  if (trimmed.length <= 4) {
    if (upper in AIRPORT_CITY_MAP) return AIRPORT_CITY_MAP[upper]
  }
  return trimmed
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
    .replace(/\b(residence\s*inn|courtyard|marriott|hilton|hyatt|sheraton|westin|holiday\s*inn|hampton|doubletree|ritz|four\s*seasons|intercontinental|radisson|best\s*western|comfort\s*inn|la\s*quinta|airbnb|vrbo|hotel|motel|hostel|inn|lodge|resort|suites?)\b/gi, '')
    .replace(/\bby\s+(marriott|hilton|hyatt|wyndham|ihg|accor|choice)\b/gi, '')
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

// ── Time Slot Helpers ──────────────────────────────────────────────────────

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

function formatTimeHHMM(date: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
  if (timezone) opts.timeZone = timezone
  return new Intl.DateTimeFormat('en-GB', opts).format(date)
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

// ── Activity Classifier ─────────────────────────────────────────────────────

function classifyActivity(summary?: string): string {
  if (!summary) return 'hanging-out'
  const s = summary.toLowerCase()

  if (/\bflight\b/.test(s)) return 'flight'
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
  if (/\b(listen|music|playlist|spotify|vinyl|record)\b/.test(s) && !/\b(concert|live)\b/.test(s)) return 'listening-music'
  if (/\b(movie|movies|cinema|film|screening)\b/.test(s)) return 'movies'
  if (/\b(watch|tv|netflix|hulu|streaming|binge|show|series)\b/.test(s) && !/\b(sports|game|match)\b/.test(s)) return 'watching-tv'
  if (/\b(park|picnic|garden|botanical)\b/.test(s)) return 'park'
  if (/\b(grill|grilling|bbq|barbecue|cookout)\b/.test(s)) return 'grilling'
  if (/\b(theater|theatre|play|musical|show|performance)\b/.test(s)) return 'movies'
  if (/\b(read|reading|book\s*club|library)\b/.test(s)) return 'reading'
  if (/\b(surf|surfing|bodyboard)\b/.test(s)) return 'surfing'
  if (/\b(gym|weight\s*lifting|weightlifting|lifting|crossfit|cross[\s-]?fit|strength|conditioning|bootcamp|boot\s*camp|f45|orangetheory|equinox)\b/.test(s)) return 'gym'
  if (/\b(yoga|pilates|barre|stretching)\b/.test(s)) return 'yoga'
  if (/\b(run|running|jog|jogging|marathon|5k|10k|half[\s-]?marathon|track|sprint)\b/.test(s)) return 'running'
  if (/\b(workout|exercise|fitness|hiit|tabata|cardio|calisthenics|peloton|soulcycle)\b/.test(s) && /\b(home|indoor|living\s*room)\b/.test(s)) return 'workout-in'
  if (/\b(swim|swimming|pool|laps)\b/.test(s)) return 'swimming'
  if (/\b(hike|hiking|trail|mountain|backpack)\b/.test(s)) return 'hiking'
  if (/\b(walk|walking|stroll|jaywalking)\b/.test(s)) return 'jaywalking'
  if (/\b(workout|exercise|fitness|hiit|tabata|cardio|calisthenics|zumba|spin|spinning|rowing|cycling|bike|biking|boxing|kickboxing|martial\s*arts|karate|judo|jiu[\s-]?jitsu|mma|basketball|soccer|football|tennis|golf|volleyball|baseball|hockey|lacrosse|rugby|cricket|athletics|peloton|soulcycle|class\s*pass|classpass|spartan|triathlon|obstacle)\b/.test(s)) return 'gym'
  if (/\b(pet|pets|feed|feeding|cat|fish\s*tank)\b/.test(s) && /\b(feed|care|sitting)\b/.test(s)) return 'feeding-pets'
  if (/\b(dog\s*walk|walk\s*(the\s*)?dog|dog\s*park)\b/.test(s)) return 'walking-dog'
  if (/\b(volunteer|volunteering|charity|fundraiser|community\s*service)\b/.test(s)) return 'volunteering'
  if (/\b(wine\s*tasting|winery|vineyard|sommelier)\b/.test(s)) return 'wine-tasting'
  if (/\b(dj|djing|turntable|mix|mixing\s*music)\b/.test(s)) return 'amateur-djing'
  if (/\b(shop|shopping|grocery|groceries|market|mall|store|target|walmart|costco|trader|whole\s*foods)\b/.test(s)) return 'shopping'

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

    // Flight detection - store actual timestamps for connecting flight chronology
    interface FlightInfo { date: string; timestamp: number; city: string | null; isReturn: boolean }
    const allFlights: FlightInfo[] = []

    // Hotel detection
    interface HotelStay { startDate: string; endDate: string; city: string }
    const hotelStays: HotelStay[] = []

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
        // Check if all-day event is a hotel stay
        if (isHotelEvent(event.summary, event.location)) {
          const hotelCity = extractHotelLocation(event.summary, event.location)
          if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
            const endExcl = new Date(event.dtend)
            endExcl.setDate(endExcl.getDate() - 1)
            hotelStays.push({
              startDate: getDateString(event.dtstart, timezone),
              endDate: getDateString(endExcl, timezone),
              city: hotelCity,
            })
          }
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
        const ts = event.dtstart.getTime()
        console.log(`[FLIGHT] "${event.summary}" | dtstart=${event.dtstart.toISOString()} | ts=${ts} | dateStr=${dateStr} | city=${city} | isReturn=${isReturn}`)
        allFlights.push({ date: dateStr, timestamp: ts, city, isReturn })
      } else if (isHotelEvent(event.summary, event.location)) {
        // Non-all-day hotel event
        const hotelCity = extractHotelLocation(event.summary, event.location)
        if (hotelCity && !isCityMatchingHome(hotelCity, homeAddress)) {
          hotelStays.push({
            startDate: getDateString(event.dtstart, timezone),
            endDate: getDateString(event.dtend, timezone),
            city: hotelCity,
          })
        }
      }
    }

    // Sort flights chronologically by actual departure time (critical for connecting flights)
    allFlights.sort((a, b) => a.timestamp - b.timestamp)
    console.log(`[FLIGHTS SORTED] ${allFlights.map(f => `${f.city}@${f.date}(ts=${f.timestamp})`).join(' → ')}`)
    console.log(`[FLIGHTS SORTED DETAIL] ${JSON.stringify(allFlights)}`)

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

    // Detect one-way flights
    interface PendingReturnTrip { destination: string; departureDate: string }
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
      const maxReturnDate = new Date(outDate + 'T00:00:00Z')
      maxReturnDate.setDate(maxReturnDate.getDate() + 30)
      const maxReturnStr = maxReturnDate.toISOString().split('T')[0]

      for (const rf of allFlights) {
        if (rf.date > outDate && rf.date <= maxReturnStr && rf.isReturn) {
          hasReturn = true
          break
        }
        if (rf.date > outDate && rf.date <= maxReturnStr && !rf.isReturn && rf.city && rf.city !== city) {
          hasReturn = true
          break
        }
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
    const allLocationByDate = new Map(flightLocationByDate)
    for (const stay of hotelStays) {
      const dates = getDateRange(stay.startDate, stay.endDate)
      for (const d of dates) {
        if (!allLocationByDate.has(d)) {
          allLocationByDate.set(d, stay.city)
        }
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

    // Update location for flight/hotel dates without busy slots
    for (const [date, city] of allLocationByDate) {
      if (busySlotsByDate.has(date)) continue
      const { error } = await adminClient
        .from('availability')
        .upsert(
          { user_id: userId, date, location_status: 'away', trip_location: city },
          { onConflict: 'user_id,date', ignoreDuplicates: false }
        )
      if (error) console.error('Error upserting location for', date, ':', error)
      else updatedCount++
    }

    // Clean stale home-city away statuses
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

    // Merge overlapping trips with same destination before flagging
    await adminClient.rpc('merge_overlapping_trips', { p_user_id: userId })

    // Flag one-way trips
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
          await adminClient
            .from('trips')
            .update({ needs_return_date: true })
            .eq('id', trips[0].id)
        }
      }
    }

    // ── Sync plans: preserve manually-enriched plans ──────────────────────

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
        pendingReturnTrips,
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
