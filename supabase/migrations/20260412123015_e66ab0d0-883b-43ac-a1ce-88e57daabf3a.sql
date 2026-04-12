
-- Update merge function to only merge future/current trips
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
  FOR v_trip IN
    SELECT id, location, start_date, end_date, needs_return_date, created_at
    FROM public.trips
    WHERE user_id = p_user_id
      AND end_date >= CURRENT_DATE
    ORDER BY start_date, created_at
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = v_trip.id) THEN
      CONTINUE;
    END IF;

    v_city := normalize_trip_city(v_trip.location);

    FOR v_other IN
      SELECT id, location, start_date, end_date, needs_return_date
      FROM public.trips
      WHERE user_id = p_user_id
        AND id != v_trip.id
        AND end_date >= CURRENT_DATE
        AND start_date <= v_trip.end_date + 1
        AND end_date >= v_trip.start_date - 1
      ORDER BY start_date
    LOOP
      v_other_city := normalize_trip_city(v_other.location);

      IF v_city != '' AND v_other_city != '' AND (
        v_city LIKE '%' || v_other_city || '%' OR
        v_other_city LIKE '%' || v_city || '%' OR
        v_city = v_other_city
      ) THEN
        UPDATE public.trips
        SET start_date = LEAST(v_trip.start_date, v_other.start_date),
            end_date = GREATEST(v_trip.end_date, v_other.end_date),
            needs_return_date = v_trip.needs_return_date AND v_other.needs_return_date,
            location = CASE 
              WHEN length(v_trip.location) <= length(v_other.location) THEN v_trip.location
              ELSE v_other.location
            END,
            updated_at = now()
        WHERE id = v_trip.id;

        v_trip.end_date := GREATEST(v_trip.end_date, v_other.end_date);
        v_trip.start_date := LEAST(v_trip.start_date, v_other.start_date);

        DELETE FROM public.trips WHERE id = v_other.id;
        v_merged := v_merged + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_merged;
END;
$$;

-- Update conflict detection to only return future/current trips
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
    AND a.end_date >= CURRENT_DATE
    AND b.end_date >= CURRENT_DATE
    AND NOT (
      normalize_trip_city(a.location) LIKE '%' || normalize_trip_city(b.location) || '%'
      OR normalize_trip_city(b.location) LIKE '%' || normalize_trip_city(a.location) || '%'
      OR normalize_trip_city(a.location) = normalize_trip_city(b.location)
    )
  ORDER BY a.start_date;
$$;
