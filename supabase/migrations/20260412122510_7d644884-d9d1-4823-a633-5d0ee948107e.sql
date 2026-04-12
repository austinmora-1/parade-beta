
-- Function to normalize a location to its city name for comparison
CREATE OR REPLACE FUNCTION public.normalize_trip_city(loc text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  normalized text;
BEGIN
  IF loc IS NULL OR trim(loc) = '' THEN
    RETURN '';
  END IF;
  -- Take first part before comma, lowercase, trim common suffixes
  normalized := lower(trim(split_part(loc, ',', 1)));
  -- Remove common hotel chain names and prefixes
  normalized := regexp_replace(normalized, '\m(residence inn|courtyard|marriott|hilton|hyatt|sheraton|westin|holiday inn|hampton|doubletree|ritz|four seasons|intercontinental|radisson|airbnb|hotel|motel|inn|lodge|resort|suites?)\M', '', 'gi');
  normalized := trim(regexp_replace(normalized, '\s+', ' ', 'g'));
  -- Remove "by" prefix leftovers like "by Marriott Palo Alto" -> "Palo Alto"
  normalized := regexp_replace(normalized, '^\s*by\s+', '', 'i');
  normalized := trim(normalized);
  RETURN normalized;
END;
$$;

-- Function to merge overlapping/adjacent trips with same destination for a user
CREATE OR REPLACE FUNCTION public.merge_overlapping_trips(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_merged integer := 0;
  v_trip RECORD;
  v_other RECORD;
  v_city text;
  v_other_city text;
BEGIN
  -- Loop through all trips for the user, ordered by start_date
  FOR v_trip IN
    SELECT id, location, start_date, end_date, needs_return_date, created_at
    FROM public.trips
    WHERE user_id = p_user_id
    ORDER BY start_date, created_at
  LOOP
    -- Skip if this trip was already deleted in a previous iteration
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = v_trip.id) THEN
      CONTINUE;
    END IF;

    v_city := normalize_trip_city(v_trip.location);

    -- Find overlapping or adjacent trips with same destination
    FOR v_other IN
      SELECT id, location, start_date, end_date, needs_return_date
      FROM public.trips
      WHERE user_id = p_user_id
        AND id != v_trip.id
        AND start_date <= v_trip.end_date + 1  -- overlapping or adjacent (within 1 day)
        AND end_date >= v_trip.start_date - 1
      ORDER BY start_date
    LOOP
      v_other_city := normalize_trip_city(v_other.location);

      -- Check if cities match (either contains the other, or both normalize to same)
      IF v_city != '' AND v_other_city != '' AND (
        v_city LIKE '%' || v_other_city || '%' OR
        v_other_city LIKE '%' || v_city || '%' OR
        v_city = v_other_city
      ) THEN
        -- Merge: expand the surviving trip's date range
        UPDATE public.trips
        SET start_date = LEAST(v_trip.start_date, v_other.start_date),
            end_date = GREATEST(v_trip.end_date, v_other.end_date),
            needs_return_date = v_trip.needs_return_date AND v_other.needs_return_date,
            -- Keep the shorter/cleaner location name (city name preferred over hotel name)
            location = CASE 
              WHEN length(v_trip.location) <= length(v_other.location) THEN v_trip.location
              ELSE v_other.location
            END,
            updated_at = now()
        WHERE id = v_trip.id;

        -- Update v_trip's end_date in memory for subsequent comparisons
        v_trip.end_date := GREATEST(v_trip.end_date, v_other.end_date);
        v_trip.start_date := LEAST(v_trip.start_date, v_other.start_date);

        -- Delete the duplicate
        DELETE FROM public.trips WHERE id = v_other.id;
        v_merged := v_merged + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_merged;
END;
$$;

-- Function to get conflicting trips (overlapping with different destinations)
CREATE OR REPLACE FUNCTION public.get_conflicting_trips(p_user_id uuid)
RETURNS TABLE(
  trip_a_id uuid,
  trip_a_location text,
  trip_a_start date,
  trip_a_end date,
  trip_b_id uuid,
  trip_b_location text,
  trip_b_start date,
  trip_b_end date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id AS trip_a_id,
    a.location AS trip_a_location,
    a.start_date AS trip_a_start,
    a.end_date AS trip_a_end,
    b.id AS trip_b_id,
    b.location AS trip_b_location,
    b.start_date AS trip_b_start,
    b.end_date AS trip_b_end
  FROM public.trips a
  JOIN public.trips b ON a.user_id = b.user_id 
    AND a.id < b.id
    AND a.start_date <= b.end_date
    AND a.end_date >= b.start_date
  WHERE a.user_id = p_user_id
    AND NOT (
      normalize_trip_city(a.location) LIKE '%' || normalize_trip_city(b.location) || '%'
      OR normalize_trip_city(b.location) LIKE '%' || normalize_trip_city(a.location) || '%'
      OR normalize_trip_city(a.location) = normalize_trip_city(b.location)
    )
  ORDER BY a.start_date;
$$;
