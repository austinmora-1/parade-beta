
-- Step 1: Clean up existing exact source_event_id duplicates (keep oldest)
DELETE FROM plans p1
USING plans p2
WHERE p1.user_id = p2.user_id
  AND p1.source = p2.source
  AND p1.source_event_id = p2.source_event_id
  AND p1.source IS NOT NULL
  AND p1.source_event_id IS NOT NULL
  AND p1.id != p2.id
  AND p1.created_at > p2.created_at;

-- Step 2: Clean up content-based duplicates (same user + date + title + start_time)
-- Only delete plans without participants
DELETE FROM plans p1
USING plans p2
WHERE p1.user_id = p2.user_id
  AND p1.date = p2.date
  AND lower(trim(p1.title)) = lower(trim(p2.title))
  AND COALESCE(p1.start_time::text, '') = COALESCE(p2.start_time::text, '')
  AND p1.id != p2.id
  AND p1.created_at > p2.created_at
  AND NOT EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = p1.id);

-- Step 3: Add unique partial index to prevent future source_event_id duplicates
CREATE UNIQUE INDEX IF NOT EXISTS plans_user_source_event_unique 
ON plans (user_id, source, source_event_id) 
WHERE source IS NOT NULL AND source_event_id IS NOT NULL;

-- Step 4: Expand normalize_trip_city with abbreviations and neighborhood mappings
CREATE OR REPLACE FUNCTION public.normalize_trip_city(loc text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized text;
  upper_loc text;
  trimmed_loc text;
BEGIN
  IF loc IS NULL OR trim(loc) = '' THEN
    RETURN '';
  END IF;

  trimmed_loc := trim(loc);
  upper_loc := upper(trimmed_loc);

  -- Check common city abbreviations / nicknames first
  CASE upper_loc
    WHEN 'NYC' THEN RETURN 'new york city';
    WHEN 'SF' THEN RETURN 'san francisco';
    WHEN 'LA' THEN RETURN 'los angeles';
    WHEN 'DC' THEN RETURN 'washington dc';
    WHEN 'NOLA' THEN RETURN 'new orleans';
    WHEN 'ATX' THEN RETURN 'austin';
    WHEN 'PHX' THEN RETURN 'phoenix';
    WHEN 'CHI' THEN RETURN 'chicago';
    WHEN 'BMORE' THEN RETURN 'baltimore';
    WHEN 'PHILLY' THEN RETURN 'philadelphia';
    WHEN 'VEGAS' THEN RETURN 'las vegas';
    WHEN 'NOLA' THEN RETURN 'new orleans';
    WHEN 'BARCA' THEN RETURN 'barcelona';
    WHEN 'CDMX' THEN RETURN 'mexico city';
    WHEN 'KL' THEN RETURN 'kuala lumpur';
    WHEN 'HK' THEN RETURN 'hong kong';
    ELSE NULL; -- continue processing
  END CASE;

  -- Check if the location is a raw airport code (3 uppercase letters)
  IF upper_loc ~ '^[A-Z]{3}$' THEN
    CASE upper_loc
      WHEN 'ATL' THEN RETURN 'atlanta';
      WHEN 'BOS' THEN RETURN 'boston';
      WHEN 'DEN' THEN RETURN 'denver';
      WHEN 'DFW' THEN RETURN 'dallas';
      WHEN 'EWR' THEN RETURN 'new york city';
      WHEN 'JFK' THEN RETURN 'new york city';
      WHEN 'LAX' THEN RETURN 'los angeles';
      WHEN 'LGA' THEN RETURN 'new york city';
      WHEN 'MIA' THEN RETURN 'miami';
      WHEN 'ORD' THEN RETURN 'chicago';
      WHEN 'SEA' THEN RETURN 'seattle';
      WHEN 'SFO' THEN RETURN 'san francisco';
      WHEN 'PHX' THEN RETURN 'phoenix';
      WHEN 'LHR' THEN RETURN 'london';
      WHEN 'LGW' THEN RETURN 'london';
      WHEN 'CDG' THEN RETURN 'paris';
      WHEN 'FCO' THEN RETURN 'rome';
      WHEN 'AMS' THEN RETURN 'amsterdam';
      WHEN 'FRA' THEN RETURN 'frankfurt';
      WHEN 'MUC' THEN RETURN 'munich';
      WHEN 'MAD' THEN RETURN 'madrid';
      WHEN 'BCN' THEN RETURN 'barcelona';
      WHEN 'ATH' THEN RETURN 'athens';
      WHEN 'IST' THEN RETURN 'istanbul';
      WHEN 'MRS' THEN RETURN 'marseille';
      WHEN 'NCE' THEN RETURN 'nice';
      WHEN 'BER' THEN RETURN 'berlin';
      WHEN 'MXP' THEN RETURN 'milan';
      WHEN 'CHQ' THEN RETURN 'chania';
      WHEN 'HER' THEN RETURN 'heraklion';
      WHEN 'SPU' THEN RETURN 'split';
      WHEN 'DBV' THEN RETURN 'dubrovnik';
      WHEN 'PRG' THEN RETURN 'prague';
      WHEN 'BUD' THEN RETURN 'budapest';
      WHEN 'NRT' THEN RETURN 'tokyo';
      WHEN 'HND' THEN RETURN 'tokyo';
      WHEN 'ICN' THEN RETURN 'seoul';
      WHEN 'SIN' THEN RETURN 'singapore';
      WHEN 'HKG' THEN RETURN 'hong kong';
      WHEN 'BKK' THEN RETURN 'bangkok';
      WHEN 'SYD' THEN RETURN 'sydney';
      WHEN 'DXB' THEN RETURN 'dubai';
      WHEN 'GRU' THEN RETURN 'são paulo';
      WHEN 'MEX' THEN RETURN 'mexico city';
      WHEN 'CUN' THEN RETURN 'cancún';
      WHEN 'GDL' THEN RETURN 'guadalajara';
      WHEN 'DPS' THEN RETURN 'denpasar';
      WHEN 'KUL' THEN RETURN 'kuala lumpur';
      WHEN 'AUS' THEN RETURN 'austin';
      WHEN 'BNA' THEN RETURN 'nashville';
      WHEN 'MSY' THEN RETURN 'new orleans';
      WHEN 'PDX' THEN RETURN 'portland';
      WHEN 'SAN' THEN RETURN 'san diego';
      WHEN 'TPA' THEN RETURN 'tampa';
      WHEN 'IAH' THEN RETURN 'houston';
      WHEN 'DCA' THEN RETURN 'washington dc';
      WHEN 'IAD' THEN RETURN 'washington dc';
      WHEN 'MCO' THEN RETURN 'orlando';
      WHEN 'LAS' THEN RETURN 'las vegas';
      WHEN 'MDW' THEN RETURN 'chicago';
      WHEN 'PHL' THEN RETURN 'philadelphia';
      WHEN 'CLT' THEN RETURN 'charlotte';
      WHEN 'DTW' THEN RETURN 'detroit';
      WHEN 'MSP' THEN RETURN 'minneapolis';
      WHEN 'SLC' THEN RETURN 'salt lake city';
      WHEN 'BWI' THEN RETURN 'baltimore';
      WHEN 'FLL' THEN RETURN 'fort lauderdale';
      WHEN 'HNL' THEN RETURN 'honolulu';
      WHEN 'RDU' THEN RETURN 'raleigh';
      WHEN 'STL' THEN RETURN 'st. louis';
      WHEN 'SMF' THEN RETURN 'sacramento';
      WHEN 'SJC' THEN RETURN 'san jose';
      WHEN 'PIT' THEN RETURN 'pittsburgh';
      WHEN 'SAT' THEN RETURN 'san antonio';
      WHEN 'OAK' THEN RETURN 'oakland';
      WHEN 'MCI' THEN RETURN 'kansas city';
      ELSE
        RETURN lower(trimmed_loc);
    END CASE;
  END IF;

  -- Check neighborhood → city mappings (case-insensitive)
  normalized := lower(trimmed_loc);
  CASE
    -- New York City neighborhoods/boroughs
    WHEN normalized IN ('brooklyn', 'manhattan', 'queens', 'bronx', 'the bronx', 'staten island', 'harlem', 'soho', 'tribeca', 'williamsburg', 'bushwick', 'astoria', 'greenpoint', 'dumbo', 'chelsea', 'midtown', 'upper east side', 'upper west side', 'lower east side', 'east village', 'west village', 'greenwich village', 'hells kitchen', 'hell''s kitchen', 'fidi', 'financial district', 'long island city') THEN RETURN 'new york city';
    -- Los Angeles neighborhoods
    WHEN normalized IN ('hollywood', 'west hollywood', 'weho', 'beverly hills', 'santa monica', 'venice beach', 'silver lake', 'echo park', 'koreatown', 'downtown la', 'dtla', 'culver city', 'malibu', 'pasadena', 'burbank', 'glendale') THEN RETURN 'los angeles';
    -- San Francisco neighborhoods
    WHEN normalized IN ('soma', 'mission district', 'the mission', 'castro', 'noe valley', 'hayes valley', 'pacific heights', 'marina district', 'north beach', 'chinatown sf', 'tenderloin', 'haight', 'haight-ashbury', 'richmond district', 'sunset district', 'potrero hill', 'dogpatch') THEN RETURN 'san francisco';
    -- Chicago neighborhoods
    WHEN normalized IN ('wicker park', 'logan square', 'lincoln park', 'lakeview', 'wrigleyville', 'river north', 'loop', 'the loop', 'old town', 'gold coast', 'hyde park', 'pilsen', 'bucktown', 'andersonville', 'uptown') THEN RETURN 'chicago';
    -- London neighborhoods
    WHEN normalized IN ('soho london', 'shoreditch', 'camden', 'notting hill', 'brixton', 'hackney', 'islington', 'kensington', 'mayfair', 'covent garden', 'westminster', 'greenwich', 'canary wharf', 'south bank', 'east end', 'west end', 'fulham', 'chelsea london', 'battersea', 'clapham', 'peckham', 'dalston') THEN RETURN 'london';
    -- Washington DC neighborhoods
    WHEN normalized IN ('georgetown', 'dupont circle', 'adams morgan', 'capitol hill', 'foggy bottom', 'u street', 'shaw', 'columbia heights', 'navy yard', 'anacostia', 'national mall') THEN RETURN 'washington dc';
    -- Miami neighborhoods
    WHEN normalized IN ('south beach', 'wynwood', 'brickell', 'little havana', 'coconut grove', 'coral gables', 'design district', 'midtown miami', 'downtown miami') THEN RETURN 'miami';
    -- Boston neighborhoods
    WHEN normalized IN ('back bay', 'beacon hill', 'south end', 'north end', 'cambridge', 'somerville', 'fenway', 'south boston', 'southie', 'charlestown', 'allston', 'brighton', 'jamaica plain', 'brookline') THEN RETURN 'boston';
    ELSE NULL; -- continue processing
  END CASE;

  -- Take first part before comma, lowercase, trim common suffixes
  normalized := lower(trim(split_part(loc, ',', 1)));
  -- Remove common hotel chain names and prefixes
  normalized := regexp_replace(normalized, '\m(residence inn|courtyard|marriott|hilton|hyatt|sheraton|westin|holiday inn|hampton|doubletree|ritz|four seasons|intercontinental|radisson|airbnb|hotel|motel|inn|lodge|resort|suites?)\M', '', 'gi');
  normalized := trim(regexp_replace(normalized, '\s+', ' ', 'g'));
  -- Remove "by" prefix leftovers
  normalized := regexp_replace(normalized, '^\s*by\s+', '', 'i');
  normalized := trim(normalized);
  RETURN normalized;
END;
$function$;
