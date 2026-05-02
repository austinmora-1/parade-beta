CREATE OR REPLACE FUNCTION public.auto_create_trip_from_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_tbc_trip RECORD;
BEGIN
  -- FAST PATH: if the client tagged this row with a trip_id, the app owns the trip lifecycle.
  IF NEW.trip_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get user's home address (only used for legacy path)
  SELECT home_address INTO v_home_address FROM public.profiles WHERE user_id = NEW.user_id;

  -- LEGACY CLEANUP PATH: row set back to 'home' or trip_location cleared, with no trip_id
  IF NEW.location_status = 'home' OR NEW.trip_location IS NULL THEN
    FOR v_trip IN
      SELECT id, location, start_date, end_date
      FROM public.trips
      WHERE user_id = NEW.user_id
        AND start_date <= NEW.date
        AND end_date   >= NEW.date
    LOOP
      -- Skip TBC trips (location IS NULL). They are user-owned placeholders that
      -- should not be auto-shrunk/deleted by availability cleanup heuristics.
      IF v_trip.location IS NULL THEN
        CONTINUE;
      END IF;

      v_old_run_start := NULL;
      v_old_run_end   := NULL;

      SELECT MIN(date) INTO v_old_run_start
      FROM public.availability
      WHERE user_id = NEW.user_id
        AND date >= v_trip.start_date
        AND date <= v_trip.end_date
        AND location_status = 'away'
        AND trip_location IS NOT NULL
        AND public.normalize_trip_city(trip_location) = public.normalize_trip_city(v_trip.location);

      IF v_old_run_start IS NOT NULL THEN
        v_old_run_end := v_old_run_start;
        LOOP
          EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.availability
            WHERE user_id = NEW.user_id
              AND date = v_old_run_end + 1
              AND location_status = 'away'
              AND trip_location IS NOT NULL
              AND public.normalize_trip_city(trip_location) = public.normalize_trip_city(v_trip.location)
          );
          v_old_run_end := v_old_run_end + 1;
        END LOOP;
      END IF;

      IF v_old_run_start IS NULL OR (v_old_run_end - v_old_run_start) < 1 THEN
        DELETE FROM public.trips WHERE id = v_trip.id;
      ELSIF v_old_run_start != v_trip.start_date OR v_old_run_end != v_trip.end_date THEN
        UPDATE public.trips
        SET start_date = v_old_run_start,
            end_date   = v_old_run_end,
            updated_at = now()
        WHERE id = v_trip.id;
      END IF;
    END LOOP;

    RETURN NEW;
  END IF;

  -- AT THIS POINT: NEW.location_status = 'away' AND NEW.trip_location IS NOT NULL

  -- TBC MERGE PATH: if a real destination arrives on a date overlapping an
  -- existing "TBC" (location IS NULL) trip for the same user, fill it in
  -- rather than creating a duplicate trip.
  SELECT id, start_date, end_date
    INTO v_tbc_trip
  FROM public.trips
  WHERE user_id = NEW.user_id
    AND location IS NULL
    AND start_date <= NEW.date
    AND end_date   >= NEW.date
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_tbc_trip.id IS NOT NULL THEN
    UPDATE public.trips
    SET location   = NEW.trip_location,
        updated_at = now()
    WHERE id = v_tbc_trip.id;

    -- Link this availability row (and any other away-without-trip-id rows in
    -- the trip's date range) to the now-resolved trip.
    UPDATE public.availability
    SET trip_id = v_tbc_trip.id
    WHERE user_id = NEW.user_id
      AND date BETWEEN v_tbc_trip.start_date AND v_tbc_trip.end_date
      AND location_status = 'away'
      AND trip_id IS NULL;

    RETURN NEW;
  END IF;

  -- LEGACY AUTO-CREATE PATH (unchanged): only when the row's trip_location
  -- is meaningfully different from the user's home, build/extend a trip.
  v_norm_trip := public.normalize_trip_city(NEW.trip_location);
  v_norm_home := public.normalize_trip_city(v_home_address);
  IF v_norm_trip IS NOT NULL AND v_norm_home IS NOT NULL AND v_norm_trip = v_norm_home THEN
    RETURN NEW;
  END IF;

  v_current_location := NEW.trip_location;

  -- Find the contiguous away-run for this same city around NEW.date
  SELECT MIN(date), MAX(date) INTO v_run_start, v_run_end
  FROM (
    SELECT date
    FROM public.availability
    WHERE user_id = NEW.user_id
      AND location_status = 'away'
      AND trip_location IS NOT NULL
      AND public.normalize_trip_city(trip_location) = v_norm_trip
      AND date BETWEEN (NEW.date - INTERVAL '60 days') AND (NEW.date + INTERVAL '60 days')
  ) sub;

  IF v_run_start IS NULL THEN
    v_run_start := NEW.date;
    v_run_end   := NEW.date;
  END IF;

  -- Look for an existing trip that already covers this run for this city
  SELECT id, start_date, end_date INTO v_trip
  FROM public.trips
  WHERE user_id = NEW.user_id
    AND location IS NOT NULL
    AND public.normalize_trip_city(location) = v_norm_trip
    AND start_date <= v_run_end
    AND end_date   >= v_run_start
  ORDER BY start_date ASC
  LIMIT 1;

  IF v_trip.id IS NOT NULL THEN
    IF v_trip.start_date != v_run_start OR v_trip.end_date != v_run_end THEN
      UPDATE public.trips
      SET start_date = LEAST(v_trip.start_date, v_run_start),
          end_date   = GREATEST(v_trip.end_date, v_run_end),
          updated_at = now()
      WHERE id = v_trip.id;
    END IF;
  ELSE
    -- Need at least 2 consecutive days to auto-materialise a trip
    IF (v_run_end - v_run_start) >= 1 THEN
      INSERT INTO public.trips (user_id, location, start_date, end_date, available_slots, priority_friend_ids)
      VALUES (
        NEW.user_id,
        v_current_location,
        v_run_start,
        v_run_end,
        ARRAY['early-morning','late-morning','early-afternoon','late-afternoon','evening','late-night']::text[],
        ARRAY[]::uuid[]
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;