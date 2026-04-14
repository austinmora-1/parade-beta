
CREATE OR REPLACE FUNCTION public.auto_create_trip_from_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_home_address TEXT;
  v_run_start DATE;
  v_run_end DATE;
  v_current_location TEXT;
  v_norm_trip TEXT;
  v_norm_home TEXT;
  v_trip_city TEXT;
  v_home_city TEXT;
  v_old_run_start DATE;
  v_old_run_end DATE;
  v_trip RECORD;
BEGIN
  -- Get user's home address
  SELECT home_address INTO v_home_address FROM public.profiles WHERE user_id = NEW.user_id;

  -- CLEANUP PATH: when a day is set back to 'home' or trip_location cleared
  IF NEW.location_status = 'home' OR NEW.trip_location IS NULL THEN
    -- For each trip covering this date, check if it needs shrinking or deletion
    FOR v_trip IN
      SELECT id, location, start_date, end_date
      FROM public.trips
      WHERE user_id = NEW.user_id
        AND start_date <= NEW.date
        AND end_date >= NEW.date
    LOOP
      -- Find actual consecutive run of away days for this trip's city
      -- that still exist within the trip's original range
      v_old_run_start := NULL;
      v_old_run_end := NULL;

      -- Find the earliest consecutive start from trip start_date
      SELECT MIN(date) INTO v_old_run_start
      FROM public.availability
      WHERE user_id = NEW.user_id
        AND date >= v_trip.start_date
        AND date <= v_trip.end_date
        AND location_status = 'away'
        AND trip_location IS NOT NULL
        AND normalize_trip_city(trip_location) = normalize_trip_city(v_trip.location);

      IF v_old_run_start IS NOT NULL THEN
        -- Find the end of the consecutive run starting from v_old_run_start
        v_old_run_end := v_old_run_start;
        LOOP
          EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.availability
            WHERE user_id = NEW.user_id
              AND date = v_old_run_end + 1
              AND location_status = 'away'
              AND trip_location IS NOT NULL
              AND normalize_trip_city(trip_location) = normalize_trip_city(v_trip.location)
          );
          v_old_run_end := v_old_run_end + 1;
        END LOOP;
      END IF;

      IF v_old_run_start IS NULL OR (v_old_run_end - v_old_run_start) < 1 THEN
        -- No consecutive days remain, delete the trip
        DELETE FROM public.trips WHERE id = v_trip.id;
      ELSIF v_old_run_start != v_trip.start_date OR v_old_run_end != v_trip.end_date THEN
        -- Consecutive run is shorter, shrink the trip
        UPDATE public.trips
        SET start_date = v_old_run_start,
            end_date = v_old_run_end,
            updated_at = now()
        WHERE id = v_trip.id;
      END IF;
    END LOOP;

    RETURN NEW;
  END IF;

  -- CLEANUP PATH for city changes: if trip_location changed to a DIFFERENT city,
  -- shrink or delete trips for the OLD city that included this date
  IF NEW.location_status = 'away' AND NEW.trip_location IS NOT NULL THEN
    FOR v_trip IN
      SELECT id, location, start_date, end_date
      FROM public.trips
      WHERE user_id = NEW.user_id
        AND start_date <= NEW.date
        AND end_date >= NEW.date
        AND normalize_trip_city(location) != normalize_trip_city(NEW.trip_location)
        AND normalize_trip_city(location) != ''
    LOOP
      -- Find actual consecutive run of away days for the old city
      v_old_run_start := NULL;
      v_old_run_end := NULL;

      SELECT MIN(date) INTO v_old_run_start
      FROM public.availability
      WHERE user_id = NEW.user_id
        AND date >= v_trip.start_date
        AND date <= v_trip.end_date
        AND location_status = 'away'
        AND trip_location IS NOT NULL
        AND normalize_trip_city(trip_location) = normalize_trip_city(v_trip.location);

      IF v_old_run_start IS NOT NULL THEN
        v_old_run_end := v_old_run_start;
        LOOP
          EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.availability
            WHERE user_id = NEW.user_id
              AND date = v_old_run_end + 1
              AND location_status = 'away'
              AND trip_location IS NOT NULL
              AND normalize_trip_city(trip_location) = normalize_trip_city(v_trip.location)
          );
          v_old_run_end := v_old_run_end + 1;
        END LOOP;
      END IF;

      IF v_old_run_start IS NULL OR (v_old_run_end - v_old_run_start) < 1 THEN
        DELETE FROM public.trips WHERE id = v_trip.id;
      ELSIF v_old_run_start != v_trip.start_date OR v_old_run_end != v_trip.end_date THEN
        UPDATE public.trips
        SET start_date = v_old_run_start,
            end_date = v_old_run_end,
            updated_at = now()
        WHERE id = v_trip.id;
      END IF;
    END LOOP;
  END IF;

  -- Only act when location_status is 'away' and trip_location is set
  IF NEW.location_status != 'away' OR NEW.trip_location IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if the trip location matches home
  IF v_home_address IS NOT NULL THEN
    v_norm_trip := lower(trim(NEW.trip_location));
    v_norm_home := lower(trim(v_home_address));
    v_trip_city := trim(regexp_replace(split_part(v_norm_trip, ',', 1), '\s*(city|town|village)$', '', 'i'));
    v_home_city := trim(regexp_replace(split_part(v_norm_home, ',', 1), '\s*(city|town|village)$', '', 'i'));
    IF v_norm_home LIKE '%' || v_norm_trip || '%' OR v_norm_trip LIKE '%' || v_norm_home || '%' THEN
      RETURN NEW;
    END IF;
    IF v_trip_city != '' AND v_home_city != '' AND (v_trip_city LIKE '%' || v_home_city || '%' OR v_home_city LIKE '%' || v_trip_city || '%') THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Find the run of consecutive away days with the same trip_location that includes NEW.date
  v_run_start := NEW.date;
  v_run_end := NEW.date;
  v_current_location := normalize_trip_city(NEW.trip_location);

  -- Expand backward
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.availability
      WHERE user_id = NEW.user_id
        AND date = v_run_start - 1
        AND location_status = 'away'
        AND trip_location IS NOT NULL
        AND normalize_trip_city(trip_location) = v_current_location
    );
    v_run_start := v_run_start - 1;
  END LOOP;

  -- Expand forward
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.availability
      WHERE user_id = NEW.user_id
        AND date = v_run_end + 1
        AND location_status = 'away'
        AND trip_location IS NOT NULL
        AND normalize_trip_city(trip_location) = v_current_location
    );
    v_run_end := v_run_end + 1;
  END LOOP;

  -- Only create a trip if 2+ consecutive days
  IF v_run_end - v_run_start < 1 THEN
    RETURN NEW;
  END IF;

  -- Check if a trip already covers this range and location
  IF EXISTS (
    SELECT 1 FROM public.trips
    WHERE user_id = NEW.user_id
      AND normalize_trip_city(location) = v_current_location
      AND start_date <= v_run_start
      AND end_date >= v_run_end
  ) THEN
    RETURN NEW;
  END IF;

  -- Check if there's an overlapping trip to the same location we should extend
  UPDATE public.trips
  SET start_date = LEAST(start_date, v_run_start),
      end_date = GREATEST(end_date, v_run_end),
      updated_at = now()
  WHERE user_id = NEW.user_id
    AND normalize_trip_city(location) = v_current_location
    AND start_date <= v_run_end + 1
    AND end_date >= v_run_start - 1;

  IF FOUND THEN
    RETURN NEW;
  END IF;

  -- Create new trip
  INSERT INTO public.trips (user_id, location, start_date, end_date)
  VALUES (NEW.user_id, NEW.trip_location, v_run_start, v_run_end);

  RETURN NEW;
END;
$function$;
