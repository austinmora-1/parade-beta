
-- Update normalize_trip_city to also resolve airport codes
CREATE OR REPLACE FUNCTION public.normalize_trip_city(loc text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized text;
  upper_loc text;
BEGIN
  IF loc IS NULL OR trim(loc) = '' THEN
    RETURN '';
  END IF;

  -- Check if the location is a raw airport code (3 uppercase letters)
  upper_loc := upper(trim(loc));
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
      ELSE
        -- Unknown code, return as-is lowercased
        RETURN lower(trim(loc));
    END CASE;
  END IF;

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
$$;

-- Fix existing trips with airport code locations
UPDATE trips SET location = 'Athens' WHERE upper(trim(location)) = 'ATH';
UPDATE trips SET location = 'Chania' WHERE upper(trim(location)) = 'CHQ';
UPDATE trips SET location = 'Guadalajara' WHERE upper(trim(location)) = 'GDL';
UPDATE trips SET location = 'Marseille' WHERE upper(trim(location)) = 'MRS';
UPDATE trips SET location = 'Phoenix' WHERE upper(trim(location)) = 'PHX';
UPDATE trips SET location = 'Nice' WHERE upper(trim(location)) = 'NCE';

-- Fix availability trip_location too
UPDATE availability SET trip_location = 'Athens' WHERE upper(trim(trip_location)) = 'ATH';
UPDATE availability SET trip_location = 'Chania' WHERE upper(trim(trip_location)) = 'CHQ';
UPDATE availability SET trip_location = 'Guadalajara' WHERE upper(trim(trip_location)) = 'GDL';
UPDATE availability SET trip_location = 'Marseille' WHERE upper(trim(trip_location)) = 'MRS';
UPDATE availability SET trip_location = 'Phoenix' WHERE upper(trim(trip_location)) = 'PHX';
UPDATE availability SET trip_location = 'Nice' WHERE upper(trim(trip_location)) = 'NCE';
