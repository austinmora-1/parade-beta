// ═══════════════════════════════════════════════════════════════════════════
// Shared calendar sync utilities — single source of truth for:
//   google-calendar-sync, ical-sync, calendar-sync-worker
// ═══════════════════════════════════════════════════════════════════════════

// ── Time Slot Helpers ──────────────────────────────────────────────────────

export function getTimeSlot(hour: number): string {
  if (hour >= 2 && hour < 9) return 'early_morning'
  if (hour >= 9 && hour < 12) return 'late_morning'
  if (hour >= 12 && hour < 15) return 'early_afternoon'
  if (hour >= 15 && hour < 18) return 'late_afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'late_night'
}

export function getHourInTimezone(date: Date, timezone?: string): number {
  if (timezone) {
    return parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).format(date),
      10
    )
  }
  return date.getUTCHours()
}

export function getDateString(date: Date, timezone?: string): string {
  if (timezone) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }
  return date.toISOString().split('T')[0]
}

export function getEventTimeSlots(startTime: Date, endTime: Date, timezone?: string): string[] {
  const slots = new Set<string>()
  const current = new Date(startTime)
  while (current < endTime) {
    slots.add(getTimeSlot(getHourInTimezone(current, timezone)))
    current.setTime(current.getTime() + 60 * 60 * 1000)
  }
  return Array.from(slots)
}

export function getEventDates(startTime: Date, endTime: Date, timezone?: string): string[] {
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

export function formatTimeHHMM(date: Date, timezone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
  if (timezone) opts.timeZone = timezone
  return new Intl.DateTimeFormat('en-GB', opts).format(date)
}

export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

/**
 * Parse a "YYYY-MM-DD" date string directly into its component parts,
 * avoiding timezone shift that occurs with `new Date("YYYY-MM-DD")`.
 * Returns the date string as-is and a Date set to noon UTC (safe for display).
 */
export function parseAllDayDate(dateStr: string): { dateString: string; noonUtc: Date } {
  const [y, m, d] = dateStr.split('-').map(Number)
  return {
    dateString: dateStr,
    noonUtc: new Date(Date.UTC(y, m - 1, d, 12, 0, 0)),
  }
}

/**
 * For all-day events spanning multiple days, get the list of date strings
 * directly from YYYY-MM-DD strings without timezone conversion.
 * startDateStr is inclusive, endDateStr is inclusive.
 */
export function getAllDayDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = []
  const current = new Date(startDateStr + 'T12:00:00Z')
  const end = new Date(endDateStr + 'T12:00:00Z')
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

// ── Airport / Flight Detection ─────────────────────────────────────────────

export const AIRPORT_CITY_MAP: Record<string, string> = {
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

// Map of well-known airport / terminal names to cities
const AIRPORT_NAME_MAP: Record<string, string> = {
  'new york kennedy': 'New York City',
  'new york jfk': 'New York City',
  'new york laguardia': 'New York City',
  'new york newark': 'New York City',
  'newark liberty': 'New York City',
  'los angeles international': 'Los Angeles',
  'san francisco international': 'San Francisco',
  'chicago ohare': 'Chicago',
  "chicago o'hare": 'Chicago',
  'chicago midway': 'Chicago',
  'dallas fort worth': 'Dallas',
  'washington dulles': 'Washington DC',
  'washington reagan': 'Washington DC',
  'washington national': 'Washington DC',
  'london heathrow': 'London',
  'london gatwick': 'London',
  'london stansted': 'London',
  'london luton': 'London',
  'london city': 'London',
  'paris charles de gaulle': 'Paris',
  'paris orly': 'Paris',
  'tokyo narita': 'Tokyo',
  'tokyo haneda': 'Tokyo',
  'istanbul sabiha': 'Istanbul',
  'milan malpensa': 'Milan',
  'milan linate': 'Milan',
  'rome fiumicino': 'Rome',
  'berlin brandenburg': 'Berlin',
}

export function resolveToCity(location: string | null | undefined): string | null {
  if (!location || !location.trim()) return null
  const trimmed = location.trim()
  const upper = trimmed.toUpperCase()
  if (/^[A-Z]{3}$/.test(upper) && upper in AIRPORT_CITY_MAP) {
    return AIRPORT_CITY_MAP[upper]
  }
  if (trimmed.length <= 4 && upper in AIRPORT_CITY_MAP) return AIRPORT_CITY_MAP[upper]
  // Check airport-name map (e.g. "New York Kennedy" → "New York City")
  const lower = trimmed.toLowerCase()
  if (lower in AIRPORT_NAME_MAP) return AIRPORT_NAME_MAP[lower]
  // Fuzzy: check if location starts with or contains a known airport name
  for (const [name, city] of Object.entries(AIRPORT_NAME_MAP)) {
    if (lower.startsWith(name) || lower.includes(name)) return city
  }
  return trimmed
}

export function extractFlightDestination(summary?: string): string | null {
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

/**
 * Extract the departure city (first airport code) from a flight summary.
 * Returns the resolved city name or null.
 */
export function extractFlightDepartureCity(summary?: string): string | null {
  if (!summary) return null
  const upper = summary.toUpperCase()
  const codes = upper.match(/\b([A-Z]{3})\b/g)
  if (codes) {
    const airports = codes.filter(c => c in AIRPORT_CITY_MAP)
    if (airports.length > 0) {
      return AIRPORT_CITY_MAP[airports[0]]
    }
  }
  return null
}

// Detect if an event is a flight — accepts either a CalendarEvent-like object or a plain summary string
export function isFlightEvent(eventOrSummary: { summary?: string } | string | undefined): boolean {
  const summary = typeof eventOrSummary === 'string'
    ? eventOrSummary
    : eventOrSummary?.summary
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

// ── Location Helpers ───────────────────────────────────────────────────────

export function isCityMatchingHome(city: string, homeAddress: string | null): boolean {
  if (!city || !homeAddress) return false
  const normCity = city.toLowerCase().trim()
  const normHome = homeAddress.toLowerCase().trim()
  if (normHome.includes(normCity) || normCity.includes(normHome)) return true
  const homeCity = normHome.split(',')[0].trim().replace(/\s*(city|town|village)$/i, '').trim()
  const flightCity = normCity.replace(/\s*(city|town|village)$/i, '').trim()
  if (homeCity && flightCity && (homeCity.includes(flightCity) || flightCity.includes(homeCity))) return true
  return false
}

export function normalizeLocation(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/\s*(city|town|village)$/i, '')
    .trim()
}

export function isLocationMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalizedA = normalizeLocation(a)
  const normalizedB = normalizeLocation(b)
  if (!normalizedA || !normalizedB) return false
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true
  const cityA = normalizedA.split(',')[0]?.trim()
  const cityB = normalizedB.split(',')[0]?.trim()
  return !!cityA && !!cityB && (cityA.includes(cityB) || cityB.includes(cityA))
}

export function isDateAfterReturn(dateStr: string, returnDates: Set<string>, outboundDates: Set<string>): boolean {
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

// ── Hotel / Reservation Detection ───────────────────────────────────────────

export const HOTEL_REGEX = /\b(hotel|airbnb|vrbo|booking|reservation|check[\s-]?in|check[\s-]?out|stay\s+at|lodging|accommodation|marriott|hilton|hyatt|sheraton|westin|holiday\s*inn|hampton|doubletree|courtyard|residence\s*inn|ritz|four\s*seasons|intercontinental|radisson|best\s*western|comfort\s*inn|la\s*quinta|motel|hostel|inn\b|lodge\b)\b/i

export function isHotelEvent(summary?: string, location?: string): boolean {
  if (!summary) return false
  if (HOTEL_REGEX.test(summary)) return true
  if (location && HOTEL_REGEX.test(location)) return true
  return false
}

export function stripHotelBrands(text: string): string {
  return text
    .replace(/\b(residence\s*inn|courtyard|marriott|hilton|hyatt|sheraton|westin|holiday\s*inn|hampton|doubletree|ritz|four\s*seasons|intercontinental|radisson|best\s*western|comfort\s*inn|la\s*quinta|airbnb|vrbo|hotel|motel|hostel|inn|lodge|resort|suites?|stay\s+at)\b/gi, '')
    .replace(/\bby\s+(marriott|hilton|hyatt|wyndham|ihg|accor|choice)\b/gi, '')
    .replace(/^\s*by\s+/i, '')
    .replace(/\s[-–—]\s/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function extractHotelLocation(summary?: string, location?: string): string | null {
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

// ── Title Normalization & Dedup ─────────────────────────────────────────────

export function normalizePlanTitle(title?: string): string {
  if (!title) return ''
  let t = title.toLowerCase().trim()
  t = t.replace(/^flight\s*(\d+\s*of\s*\d+\s*\|?\s*)?/i, '')
  t = t.replace(/\|/g, ' ')
  t = t.replace(/([a-z]{2})0+(\d)/gi, '$1$2')
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

/**
 * Extract a flight number (airline IATA code + digits) from a title.
 * Handles formats like: DL0679, DL 679, DL679, (DL 679), UA 1234
 * Returns normalized lowercase form with leading zeros stripped, e.g. "dl679"
 */
export function extractFlightNumber(title?: string): string | null {
  if (!title) return null
  // Match 2-letter IATA airline code followed by optional space and 1-4 digits
  const match = title.match(/\b([A-Za-z]{2})\s?0*(\d{1,4})\b/)
  if (!match) return null
  const airline = match[1].toLowerCase()
  const number = match[2]
  // Validate: the 2-letter code should look like an airline (not a random word fragment)
  // Common IATA prefixes — we accept any 2-letter code that's followed by digits
  // but filter out obviously wrong matches like "at", "in", "to", "on", "am", "pm"
  const excluded = new Set(['at', 'in', 'to', 'on', 'am', 'pm', 'an', 'as', 'be', 'by', 'do', 'go', 'he', 'if', 'is', 'it', 'me', 'my', 'no', 'of', 'or', 'so', 'up', 'us', 'we'])
  if (excluded.has(airline)) return null
  return `${airline}${number}`
}

export function isFlightTitle(normalizedTitle: string): boolean {
  // Check for flight number pattern first
  if (extractFlightNumber(normalizedTitle)) return true
  // Fall back to 2+ airport codes
  const upper = normalizedTitle.toUpperCase()
  const codes = upper.match(/\b([A-Z]{3})\b/g)
  if (!codes) return false
  return codes.filter(c => c in AIRPORT_CITY_MAP).length >= 2
}

export function extractDateOnly(date: string): string {
  return date.replace(/^(\d{4}-\d{2}-\d{2}).*/, '$1')
}

export function makeContentKey(normalizedTitle: string, date: string, startTime: string | null): string {
  const d = extractDateOnly(date)
  // Flight number-based key: all formats of the same flight produce the same key
  const flightNum = extractFlightNumber(normalizedTitle)
  if (flightNum) {
    return `flight:${flightNum}|${d}`
  }
  if (isFlightTitle(normalizedTitle)) {
    return `${normalizedTitle}|${d}`
  }
  const t = startTime ? startTime.substring(0, 5) : '' // normalize HH:MM:SS → HH:MM
  return `${normalizedTitle}|${d}|${t}`
}

// ── Activity Classifier ─────────────────────────────────────────────────────

export function classifyActivity(summary?: string, isFlight = false): string {
  if (isFlight) return 'flight'
  if (!summary) return 'hanging-out'
  const s = summary.toLowerCase()

  // ── Flights ──
  if (/\bflight\b/.test(s)) return 'flight'
  if (extractFlightNumber(summary)) return 'flight'

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
  if (/\b(workout|exercise|fitness|hiit|tabata|cardio|calisthenics|zumba|spin|spinning|rowing|cycling|bike|biking|boxing|kickboxing|martial\s*arts|karate|judo|jiu[\s-]?jitsu|mma|basketball|soccer|football|tennis|golf|volleyball|baseball|hockey|lacrosse|rugby|cricket|athletics|peloton|soulcycle|class\s*pass|classpass|spartan|triathlon|obstacle)\b/.test(s)) return 'gym'

  // ── Productive ──
  if (/\b(pet|pets|feed|feeding|cat|fish\s*tank)\b/.test(s) && /\b(feed|care|sitting)\b/.test(s)) return 'feeding-pets'
  if (/\b(dog\s*walk|walk\s*(the\s*)?dog|dog\s*park)\b/.test(s)) return 'walking-dog'
  if (/\b(volunteer|volunteering|charity|fundraiser|community\s*service)\b/.test(s)) return 'volunteering'
  if (/\b(wine\s*tasting|winery|vineyard|sommelier)\b/.test(s)) return 'wine-tasting'
  if (/\b(dj|djing|turntable|mix|mixing\s*music)\b/.test(s)) return 'amateur-djing'
  if (/\b(shop|shopping|grocery|groceries|market|mall|store|target|walmart|costco|trader|whole\s*foods)\b/.test(s)) return 'shopping'

  return 'hanging-out'
}

// ── ICS Parser ──────────────────────────────────────────────────────────────

export interface ICalEvent {
  uid: string
  summary: string
  dtstart: Date
  dtend: Date
  isAllDay: boolean
  location?: string
}

export function parseICS(icsText: string, rangeStart: Date, rangeEnd: Date): ICalEvent[] {
  const events: ICalEvent[] = []
  const lines = unfoldLines(icsText)

  let inEvent = false
  let uid = ''
  let summary = ''
  let dtstart: Date | null = null
  let dtend: Date | null = null
  let isAllDay = false
  let location = ''
  let rrule = ''
  let exdates: Set<string> = new Set()

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      uid = ''; summary = ''; dtstart = null; dtend = null; isAllDay = false; location = ''; rrule = ''; exdates = new Set()
      continue
    }

    if (line === 'END:VEVENT') {
      inEvent = false
      if (dtstart && dtend) {
        if (rrule) {
          // Expand recurring event instances
          const instances = expandRRule(rrule, dtstart, dtend, isAllDay, rangeStart, rangeEnd, exdates)
          for (const inst of instances) {
            events.push({ uid: `${uid}_${inst.dtstart.toISOString()}`, summary, dtstart: inst.dtstart, dtend: inst.dtend, isAllDay, location: location || undefined })
          }
        } else if (dtend > rangeStart && dtstart < rangeEnd) {
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
      if (parsed) { dtstart = parsed.date; isAllDay = parsed.allDay }
    } else if (line.startsWith('DTEND')) {
      const parsed = parseICSDate(line)
      if (parsed) dtend = parsed.date
    } else if (line.startsWith('RRULE:')) {
      rrule = line.slice(6)
    } else if (line.startsWith('EXDATE')) {
      const parsed = parseICSDate(line)
      if (parsed) exdates.add(parsed.date.toISOString().split('T')[0])
    }
  }

  return events
}

// ── RRULE Expansion ─────────────────────────────────────────────────────────
// Supports FREQ=DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL, BYDAY.
// Generates individual instances within [rangeStart, rangeEnd].

function expandRRule(
  rrule: string,
  dtstart: Date,
  dtend: Date,
  isAllDay: boolean,
  rangeStart: Date,
  rangeEnd: Date,
  exdates: Set<string>,
): { dtstart: Date; dtend: Date }[] {
  const parts = new Map<string, string>()
  for (const part of rrule.split(';')) {
    const [k, v] = part.split('=')
    if (k && v) parts.set(k.toUpperCase(), v.toUpperCase())
  }

  const freq = parts.get('FREQ')
  if (!freq) return []

  const interval = parseInt(parts.get('INTERVAL') || '1')
  const count = parts.has('COUNT') ? parseInt(parts.get('COUNT')!) : undefined
  const until = parts.has('UNTIL') ? parseRRuleUntil(parts.get('UNTIL')!) : undefined
  const byDay = parts.has('BYDAY') ? parts.get('BYDAY')!.split(',') : undefined

  const duration = dtend.getTime() - dtstart.getTime()
  const instances: { dtstart: Date; dtend: Date }[] = []
  const maxInstances = 500 // safety cap
  let generated = 0

  const DAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

  let current = new Date(dtstart)

  while (generated < maxInstances) {
    if (until && current > until) break
    if (count !== undefined && generated >= count) break
    if (current > rangeEnd) break

    const endCurrent = new Date(current.getTime() + duration)

    if (endCurrent > rangeStart && current < rangeEnd) {
      const dateKey = current.toISOString().split('T')[0]
      if (!exdates.has(dateKey)) {
        // If BYDAY specified for WEEKLY, check day matches
        if (freq === 'WEEKLY' && byDay) {
          const dayOfWeek = current.getUTCDay()
          const dayAbbrevs = Object.entries(DAY_MAP)
          const dayName = dayAbbrevs.find(([, num]) => num === dayOfWeek)?.[0]
          if (dayName && byDay.includes(dayName)) {
            instances.push({ dtstart: new Date(current), dtend: endCurrent })
          }
        } else {
          instances.push({ dtstart: new Date(current), dtend: endCurrent })
        }
      }
    }

    generated++

    // Advance to next occurrence
    if (freq === 'DAILY') {
      current.setUTCDate(current.getUTCDate() + interval)
    } else if (freq === 'WEEKLY') {
      if (byDay && byDay.length > 1) {
        // For multi-day BYDAY, advance one day at a time
        current.setUTCDate(current.getUTCDate() + 1)
        // But count interval only after cycling through a full week
        const startDow = dtstart.getUTCDay()
        if (current.getUTCDay() === startDow) {
          current.setUTCDate(current.getUTCDate() + (interval - 1) * 7)
        }
      } else {
        current.setUTCDate(current.getUTCDate() + interval * 7)
      }
    } else if (freq === 'MONTHLY') {
      current.setUTCMonth(current.getUTCMonth() + interval)
    } else if (freq === 'YEARLY') {
      current.setUTCFullYear(current.getUTCFullYear() + interval)
    } else {
      break // unsupported frequency
    }
  }

  return instances
}

function parseRRuleUntil(value: string): Date {
  const y = parseInt(value.slice(0, 4))
  const m = parseInt(value.slice(4, 6)) - 1
  const d = parseInt(value.slice(6, 8))
  if (value.length >= 15) {
    const h = parseInt(value.slice(9, 11))
    const min = parseInt(value.slice(11, 13))
    const s = parseInt(value.slice(13, 15)) || 0
    return new Date(Date.UTC(y, m, d, h, min, s))
  }
  return new Date(Date.UTC(y, m, d, 23, 59, 59))
}

function unfoldLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n')
}

function unescapeICS(text: string): string {
  return text.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

export function parseICSDate(line: string): { date: Date; allDay: boolean } | null {
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

// ── Google Calendar Event Interface ─────────────────────────────────────────

export interface CalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
}

// ── Google Calendar Paginated Fetch ─────────────────────────────────────────
// Fetches ALL events across ALL user calendars via calendarList + pagination.
// Deduplicates by event ID across calendars.

async function fetchCalendarIds(accessToken: string): Promise<string[]> {
  const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=100'
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    console.warn(`calendarList failed (${response.status}), falling back to primary only`)
    return ['primary']
  }
  const data = await response.json()
  const ids = (data.items || []).map((c: any) => c.id as string)
  console.log(`[calendar-sync] Found ${ids.length} calendars: ${ids.join(', ')}`)
  return ids.length > 0 ? ids : ['primary']
}

async function fetchEventsFromCalendar(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = []
  let pageToken: string | undefined = undefined
  const maxPages = 10

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('maxResults', '250')
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      if (page === 0) {
        console.warn(`[calendar-sync] Skipping calendar ${calendarId}: ${response.status}`)
        return events
      }
      console.warn(`[calendar-sync] Pagination stopped for ${calendarId} at page ${page}: ${response.status}`)
      break
    }

    const data = await response.json()
    const items: CalendarEvent[] = data.items || []
    events.push(...items)

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }

  console.log(`[calendar-sync] Calendar "${calendarId}": ${events.length} events`)
  return events
}

export async function fetchAllGoogleEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const calendarIds = await fetchCalendarIds(accessToken)
  const seenIds = new Set<string>()
  const allEvents: CalendarEvent[] = []

  for (const calId of calendarIds) {
    const events = await fetchEventsFromCalendar(accessToken, calId, timeMin, timeMax)
    for (const event of events) {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id)
        allEvents.push(event)
      }
    }
  }

  console.log(`[calendar-sync] Total unique events across all calendars: ${allEvents.length}`)
  return allEvents
}

// ── Shared Plan Reconciliation ──────────────────────────────────────────────
// Extracted from all 3 sync functions to prevent drift in dedup logic.

export async function reconcilePlans(params: {
  adminClient: any
  userId: string
  source: 'gcal' | 'ical'
  planRowsByEventId: Map<string, any>
  incomingEventIds: Set<string>
}): Promise<void> {
  const { adminClient, userId, source, planRowsByEventId, incomingEventIds } = params

  // Fetch existing plans for this source
  const { data: existingPlans } = await adminClient
    .from('plans')
    .select('id, source_event_id, title, date, start_time, manually_edited')
    .eq('user_id', userId)
    .eq('source', source)

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

  // Find enriched plan IDs: manually_edited OR has participants
  const existingPlanIds = (existingPlans || []).map((p: any) => p.id)
  const enrichedPlanIds = new Set<string>()
  for (const p of (existingPlans || [])) {
    if (p.manually_edited) enrichedPlanIds.add(p.id)
  }
  if (existingPlanIds.length > 0) {
    const { data: participantRows } = await adminClient
      .from('plan_participants')
      .select('plan_id')
      .in('plan_id', existingPlanIds)
    for (const r of (participantRows || [])) enrichedPlanIds.add(r.plan_id)
  }

  // Build lookup of existing event_id → plan
  const existingByEventId = new Map<string, any>()
  for (const p of (existingPlans || [])) {
    if (p.source_event_id) existingByEventId.set(p.source_event_id, p)
  }

  // Delete plans no longer in calendar AND not enriched AND not manually edited
  const toDelete = (existingPlans || []).filter((p: any) =>
    !incomingEventIds.has(p.source_event_id) && !enrichedPlanIds.has(p.id)
  )
  if (toDelete.length > 0) {
    await adminClient.from('plans').delete().in('id', toDelete.map((p: any) => p.id))
  }

  // Upsert: skip enriched, update existing, content-dedup, insert new
  const toInsert: any[] = []
  for (const [eventId, planRow] of planRowsByEventId) {
    const existing = existingByEventId.get(eventId)
    if (existing) {
      if (enrichedPlanIds.has(existing.id) || existing.manually_edited) continue
      await adminClient.from('plans').update({
        title: planRow.title,
        activity: planRow.activity,
        date: planRow.date,
        time_slot: planRow.time_slot,
        start_time: planRow.start_time,
        end_time: planRow.end_time,
        ...(planRow.location !== undefined ? { location: planRow.location } : {}),
      }).eq('id', existing.id)
    } else {
      // Content-based dedup
      const nt = normalizePlanTitle(planRow.title)
      const contentKey = makeContentKey(nt, planRow.date, planRow.start_time)
      const contentMatch = contentLookup.get(contentKey)
      if (contentMatch) {
        const mergeFields: Record<string, any> = {}
        if (!contentMatch.source_event_id || contentMatch.source === source) {
          mergeFields.source = source
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
    const { error: plansError } = await adminClient.from('plans').insert(toInsert)
    if (plansError) {
      if (plansError.code === '23505') {
        for (const row of toInsert) {
          const { error: singleErr } = await adminClient.from('plans').insert(row)
          if (singleErr && singleErr.code !== '23505') console.error('Error inserting plan:', singleErr)
        }
      } else {
        console.error(`Error inserting ${source} plans:`, plansError)
      }
    }
  }
}

// ── Shared Types ────────────────────────────────────────────────────────────

export interface FlightInfo {
  date: string
  timestamp: number        // departure time (ms)
  arrivalTimestamp: number  // arrival/landing time (ms)
  city: string | null       // destination city
  departureCity: string | null // origin city
  isReturn: boolean
}

export interface HotelStay {
  startDate: string
  endDate: string
  city: string
}

export interface PendingReturnTrip {
  destination: string
  departureDate: string
}

export interface ExistingTrip {
  id: string
  location: string
  start_date: string
  end_date: string
  needs_return_date: boolean
}

// ── City Normalization (matches DB normalize_trip_city) ─────────────────────

const CITY_ABBREV_MAP: Record<string, string> = {
  NYC: 'new york city', SF: 'san francisco', LA: 'los angeles',
  DC: 'washington dc', NOLA: 'new orleans', ATX: 'austin',
  PHX: 'phoenix', CHI: 'chicago', BMORE: 'baltimore',
  PHILLY: 'philadelphia', VEGAS: 'las vegas', BARCA: 'barcelona',
  CDMX: 'mexico city', KL: 'kuala lumpur', HK: 'hong kong',
}

const AIRPORT_CITY_NORM: Record<string, string> = Object.fromEntries(
  Object.entries(AIRPORT_CITY_MAP).map(([code, city]) => [code, city.toLowerCase()])
)

/**
 * Normalize a city name to lowercase canonical form, matching the DB's
 * normalize_trip_city() function output. Used for comparing cities across
 * Edge Functions and the DB trigger.
 */
export function normalizeCityForComparison(location: string | null | undefined): string {
  if (!location || !location.trim()) return ''
  const trimmed = location.trim()
  const upper = trimmed.toUpperCase()

  // Check abbreviations
  if (upper in CITY_ABBREV_MAP) return CITY_ABBREV_MAP[upper]

  // Check airport codes
  if (/^[A-Z]{3}$/.test(upper) && upper in AIRPORT_CITY_NORM) {
    return AIRPORT_CITY_NORM[upper]
  }

  // Take first part before comma, lowercase, strip hotel brands
  let normalized = trimmed.split(',')[0].toLowerCase().trim()
  normalized = normalized
    .replace(/\b(residence\s*inn|courtyard|marriott|hilton|hyatt|sheraton|westin|holiday\s*inn|hampton|doubletree|ritz|four\s*seasons|intercontinental|radisson|best\s*western|comfort\s*inn|la\s*quinta|airbnb|vrbo|hotel|motel|hostel|inn|lodge|resort|suites?|stay\s+at)\b/gi, '')
    .replace(/\bby\s+(marriott|hilton|hyatt|wyndham|ihg|accor|choice)\b/gi, '')
    .replace(/^\s*by\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
}

// ── Segment-Based Location Resolution ───────────────────────────────────────

/**
 * Resolves which city a user is in on each date, using a segment-based approach
 * that supports multi-leg trips (e.g., JFK→SFO on Apr 13, SFO→DFW on Apr 17,
 * DFW→JFK on Apr 24 produces two segments: SF Apr 13–16, Dallas Apr 17–23).
 *
 * Replaces the old binary outbound/return logic that was duplicated across
 * google-calendar-sync, ical-sync, and calendar-sync-worker.
 */
export function resolveLocationsByDate(params: {
  allFlights: FlightInfo[]
  hotelStays: HotelStay[]
  homeAddress: string | null
  existingTrips: ExistingTrip[]
}): {
  locationByDate: Map<string, string>
  returnHomeDates: Set<string>
  outboundFlightDates: Set<string>
  pendingReturnTrips: PendingReturnTrip[]
} {
  const { allFlights, hotelStays, homeAddress, existingTrips } = params

  // Sort flights chronologically
  const sortedFlights = [...allFlights].sort((a, b) => a.timestamp - b.timestamp)
  console.log(`[FLIGHTS SORTED] ${sortedFlights.map(f => `${f.city}@${f.date}(ts=${f.timestamp})`).join(' → ')}`)

  // Group flights by date, last flight on each date determines the outcome
  const flightsByDate = new Map<string, FlightInfo[]>()
  for (const f of sortedFlights) {
    if (!flightsByDate.has(f.date)) flightsByDate.set(f.date, [])
    flightsByDate.get(f.date)!.push(f)
  }

  // Determine return vs outbound per date (last flight wins)
  const returnHomeDates = new Set<string>()
  const outboundFlightDates = new Set<string>()
  const flightCityByDate = new Map<string, string>() // date → destination city

  for (const [date, flights] of flightsByDate) {
    const lastFlight = flights[flights.length - 1]
    if (lastFlight.isReturn) {
      returnHomeDates.add(date)
    } else if (lastFlight.city) {
      outboundFlightDates.add(date)
      flightCityByDate.set(date, lastFlight.city)
    }
  }

  const allFlightDatesSet = new Set(sortedFlights.map(f => f.date))

  // Build segments: each outbound flight starts a segment that ends when:
  // 1. A different-city outbound flight occurs (segment ends day before)
  // 2. A return-home flight occurs (segment ends day before return)
  // 3. No terminating event within 30 days (one-way / pending return)
  const outboundEntries = Array.from(flightCityByDate.entries()).sort(([a], [b]) => a.localeCompare(b))
  const locationByDate = new Map<string, string>()
  const pendingReturnTrips: PendingReturnTrip[] = []

  for (let i = 0; i < outboundEntries.length; i++) {
    const [outDate, city] = outboundEntries[i]

    // Set the flight date itself
    locationByDate.set(outDate, city)

    // Check if an existing manually-managed trip covers this flight
    const resolvedTrip = existingTrips.find((trip) =>
      !trip.needs_return_date &&
      isLocationMatch(trip.location, city) &&
      trip.start_date <= outDate &&
      trip.end_date >= outDate
    )

    if (resolvedTrip) {
      // Fill dates from the manual trip's range, stopping at any flight date
      const current = new Date(outDate + 'T00:00:00Z')
      current.setDate(current.getDate() + 1)
      const manualEnd = new Date(resolvedTrip.end_date + 'T00:00:00Z')
      while (current <= manualEnd) {
        const dateStr = current.toISOString().split('T')[0]
        if (allFlightDatesSet.has(dateStr)) break
        locationByDate.set(dateStr, city)
        current.setDate(current.getDate() + 1)
      }
      continue
    }

    // Find the terminating event: next outbound to different city OR return home
    let terminatingDate: string | null = null
    const maxDate = new Date(outDate + 'T00:00:00Z')
    maxDate.setDate(maxDate.getDate() + 30)
    const maxDateStr = maxDate.toISOString().split('T')[0]

    // Check next outbound flights to different cities
    for (let j = i + 1; j < outboundEntries.length; j++) {
      const [nextDate, nextCity] = outboundEntries[j]
      if (nextDate > maxDateStr) break
      if (normalizeCityForComparison(nextCity) !== normalizeCityForComparison(city)) {
        terminatingDate = nextDate
        break
      }
    }

    // Check return flights
    for (const rd of returnHomeDates) {
      if (rd > outDate && rd <= maxDateStr) {
        if (!terminatingDate || rd < terminatingDate) {
          terminatingDate = rd
        }
      }
    }

    if (terminatingDate) {
      // Fill intermediate dates up to (but not including) the terminating date
      const current = new Date(outDate + 'T00:00:00Z')
      current.setDate(current.getDate() + 1)
      const termDate = new Date(terminatingDate + 'T00:00:00Z')
      while (current < termDate) {
        const dateStr = current.toISOString().split('T')[0]
        if (allFlightDatesSet.has(dateStr)) break
        locationByDate.set(dateStr, city)
        current.setDate(current.getDate() + 1)
      }
    } else {
      // No terminating event found — fill 7 days and mark as pending return
      const current = new Date(outDate + 'T00:00:00Z')
      current.setDate(current.getDate() + 1)
      for (let d = 0; d < 7; d++) {
        const dateStr = current.toISOString().split('T')[0]
        if (allFlightDatesSet.has(dateStr)) break
        locationByDate.set(dateStr, city)
        current.setDate(current.getDate() + 1)
      }
      pendingReturnTrips.push({ destination: city, departureDate: outDate })
    }
  }

  // Apply hotel stays (flight-derived locations take priority)
  for (const stay of hotelStays) {
    const dates = getDateRange(stay.startDate, stay.endDate)
    for (const d of dates) {
      if (!locationByDate.has(d)) locationByDate.set(d, stay.city)
    }
  }

  console.log(`[LOCATION BY DATE] ${JSON.stringify(Object.fromEntries(locationByDate))}`)

  return { locationByDate, returnHomeDates, outboundFlightDates, pendingReturnTrips }
}

// ── Per-Slot Location Resolution ────────────────────────────────────────────

const SLOT_NAMES = ['early_morning', 'late_morning', 'early_afternoon', 'late_afternoon', 'evening', 'late_night'] as const
const SLOT_DB_COLS = ['slot_location_early_morning', 'slot_location_late_morning', 'slot_location_early_afternoon', 'slot_location_late_afternoon', 'slot_location_evening', 'slot_location_late_night'] as const

/**
 * For each flight day, resolve per-slot locations:
 * - Slots before departure → departure city (or previous day's location)
 * - Slots during the flight → null (unavailable, handled by busy slots)
 * - Slots at or after arrival → destination city
 */
export function resolveSlotLocations(params: {
  allFlights: FlightInfo[]
  locationByDate: Map<string, string>
  homeAddress: string | null
  timezone?: string
}): Map<string, Record<string, string | null>> {
  const { allFlights, locationByDate, homeAddress, timezone } = params
  const result = new Map<string, Record<string, string | null>>()

  // Group flights by date
  const flightsByDate = new Map<string, FlightInfo[]>()
  for (const f of allFlights) {
    if (!flightsByDate.has(f.date)) flightsByDate.set(f.date, [])
    flightsByDate.get(f.date)!.push(f)
  }

  for (const [date, flights] of flightsByDate) {
    // Sort flights on this day by departure time
    const sorted = [...flights].sort((a, b) => a.timestamp - b.timestamp)
    
    const slotLocations: Record<string, string | null> = {}
    for (const col of SLOT_DB_COLS) slotLocations[col] = null

    // Determine the "before" location: departure city of first flight, or previous day location, or home
    const firstFlight = sorted[0]
    const prevDateStr = (() => {
      const d = new Date(date + 'T12:00:00Z')
      d.setDate(d.getDate() - 1)
      return d.toISOString().split('T')[0]
    })()
    const beforeLocation = firstFlight.departureCity
      || locationByDate.get(prevDateStr)
      || (homeAddress ? homeAddress.split(',')[0].trim() : null)

    // For each slot, determine location based on flight timing
    for (let si = 0; si < SLOT_NAMES.length; si++) {
      const slotName = SLOT_NAMES[si]
      const slotCol = SLOT_DB_COLS[si]
      const slotHour = getSlotStartHour(slotName)
      // Build a Date for the slot start in the user's timezone
      const slotTimestamp = getSlotTimestamp(date, slotHour, timezone)

      // Find which flight window this slot falls in
      let location: string | null = null
      let isDuringFlight = false

      for (const flight of sorted) {
        if (slotTimestamp < flight.timestamp) {
          // Before this flight's departure
          location = flight.departureCity || beforeLocation
          break
        } else if (slotTimestamp >= flight.timestamp && slotTimestamp < flight.arrivalTimestamp) {
          // During the flight — mark as in-transit (null = unavailable)
          isDuringFlight = true
          break
        } else if (slotTimestamp >= flight.arrivalTimestamp) {
          // After this flight's arrival — use destination
          location = flight.city || null
          // Don't break — a later flight on the same day may override
        }
      }

      if (isDuringFlight) {
        slotLocations[slotCol] = null // Will be marked unavailable via busy slots
      } else {
        slotLocations[slotCol] = location
      }
    }

    // Only store if there's actual variation (not all the same)
    const values = SLOT_DB_COLS.map(c => slotLocations[c])
    const unique = new Set(values.filter(Boolean))
    if (unique.size > 1 || values.some(v => v === null && unique.size > 0)) {
      result.set(date, slotLocations)
    }
  }

  return result
}

function getSlotStartHour(slotName: string): number {
  switch (slotName) {
    case 'early_morning': return 2
    case 'late_morning': return 9
    case 'early_afternoon': return 12
    case 'late_afternoon': return 15
    case 'evening': return 18
    case 'late_night': return 22
    default: return 12
  }
}

function getSlotTimestamp(dateStr: string, hour: number, timezone?: string): number {
  // Create a timestamp for the given hour on the given date in the user's timezone
  const d = new Date(dateStr + 'T12:00:00Z')
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const day = d.getUTCDate()
  
  if (timezone) {
    // Approximate: create UTC date at that hour and adjust for timezone offset
    const guessUtc = new Date(Date.UTC(year, month, day, hour, 0, 0))
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone, hour: 'numeric', hour12: false,
      })
      const localHour = parseInt(formatter.format(guessUtc), 10)
      const offsetHours = localHour - hour
      return guessUtc.getTime() - offsetHours * 3600000
    } catch {
      return guessUtc.getTime()
    }
  }
  return new Date(Date.UTC(year, month, day, hour, 0, 0)).getTime()
}

// ── Shared Availability Upsert Logic ────────────────────────────────────────

/**
 * Upserts availability rows with location info, clears stale away statuses,
 * handles pending return trips, and merges overlapping trips.
 * Extracted to prevent drift across sync paths.
 */
export async function upsertAvailabilityWithLocation(params: {
  adminClient: any
  userId: string
  busySlotsByDate: Map<string, Set<string>>
  locationByDate: Map<string, string>
  returnHomeDates: Set<string>
  outboundFlightDates: Set<string>
  pendingReturnTrips: PendingReturnTrip[]
  homeAddress: string | null
  syncRangeStart: string
  syncRangeEnd: string
  slotLocationsByDate?: Map<string, Record<string, string | null>>
}): Promise<number> {
  const {
    adminClient, userId, busySlotsByDate, locationByDate,
    returnHomeDates, outboundFlightDates, pendingReturnTrips,
    homeAddress, syncRangeStart, syncRangeEnd, slotLocationsByDate,
  } = params

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

  // Upsert busy slots with location
  for (const [date, slots] of busySlotsByDate) {
    const slotUpdates: Record<string, boolean> = {}
    for (const slot of slots) slotUpdates[slot] = false

    const locationCity = locationByDate.get(date)
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

    // Add per-slot location columns if available for this date
    const slotLocs = slotLocationsByDate?.get(date)
    const slotLocFields: Record<string, string | null> = {}
    if (slotLocs) {
      Object.assign(slotLocFields, slotLocs)
    }

    const { error } = await adminClient
      .from('availability')
      .upsert({ user_id: userId, date, ...slotUpdates, ...locationFields, ...slotLocFields }, { onConflict: 'user_id,date', ignoreDuplicates: false })
    if (!error) updatedCount++
  }

  // Upsert location-only dates
  for (const [date, city] of locationByDate) {
    if (busySlotsByDate.has(date)) continue
    const slotLocs = slotLocationsByDate?.get(date)
    const slotLocFields: Record<string, string | null> = slotLocs ? { ...slotLocs } : {}
    const { error } = await adminClient
      .from('availability')
      .upsert({ user_id: userId, date, location_status: 'away', trip_location: city, ...slotLocFields }, { onConflict: 'user_id,date', ignoreDuplicates: false })
    if (!error) updatedCount++
  }

  // Clear stale away statuses
  for (const existingRow of (existingAvailabilityRows || [])) {
    if (busySlotsByDate.has(existingRow.date) || locationByDate.has(existingRow.date)) continue
    const isReturnDate = returnHomeDates.has(existingRow.date)
    const shouldClear = isReturnDate ||
      (existingRow.trip_location && isCityMatchingHome(existingRow.trip_location, homeAddress)) ||
      (existingRow.trip_location && !isCityMatchingHome(existingRow.trip_location, homeAddress) && isDateAfterReturn(existingRow.date, returnHomeDates, outboundFlightDates))
    if (shouldClear) {
      await adminClient
        .from('availability')
        .upsert({ user_id: userId, date: existingRow.date, location_status: 'home', trip_location: null }, { onConflict: 'user_id,date', ignoreDuplicates: false })
    }
  }

  // Merge overlapping trips
  await adminClient.rpc('merge_overlapping_trips', { p_user_id: userId })

  // Handle pending return trips
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

  return updatedCount
}
