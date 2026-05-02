-- 1) Add trip_id to availability + index
ALTER TABLE public.availability
ADD COLUMN IF NOT EXISTS trip_id uuid NULL REFERENCES public.trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_availability_trip_id ON public.availability(trip_id);

-- 2) Backfill: link availability rows to a unique matching trip when possible
UPDATE public.availability a
SET trip_id = sub.trip_id
FROM (
  SELECT a2.id AS avail_id,
         (SELECT t.id
            FROM public.trips t
            WHERE t.user_id = a2.user_id
              AND t.start_date <= a2.date
              AND t.end_date   >= a2.date
              AND public.normalize_trip_city(t.location) = public.normalize_trip_city(a2.trip_location)
            ORDER BY t.created_at ASC
            LIMIT 1) AS trip_id
  FROM public.availability a2
  WHERE a2.location_status = 'away'
    AND a2.trip_location IS NOT NULL
    AND a2.trip_id IS NULL
) sub
WHERE a.id = sub.avail_id
  AND sub.trip_id IS NOT NULL;

-- 3) Replace trigger function: trust trip_id when set, keep legacy heuristics otherwise
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
  -- FAST PATH: if the client tagged this row with a trip_id, the app owns the trip lifecycle.
  -- Do not create, extend, shrink, or delete trips here.
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

  -- LEGACY: city-change cleanup for trips covering this date with a different city
  IF NEW.location_status = 'away' AND NEW.trip_location IS NOT NULL THEN
    FOR v_trip IN
      SELECT id, location, start_date, end_date
      FROM public.trips
      WHERE user_id = NEW.user_id
        AND start_date <= NEW.date
        AND end_date   >= NEW.date
        AND public.normalize_trip_city(location) != public.normalize_trip_city(NEW.trip_location)
        AND public.normalize_trip_city(location) != ''
    LOOP
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

  -- Find consecutive away-day run for this city
  v_run_start := NEW.date;
  v_run_end   := NEW.date;
  v_current_location := public.normalize_trip_city(NEW.trip_location);

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.availability
      WHERE user_id = NEW.user_id
        AND date = v_run_start - 1
        AND location_status = 'away'
        AND trip_location IS NOT NULL
        AND public.normalize_trip_city(trip_location) = v_current_location
    );
    v_run_start := v_run_start - 1;
  END LOOP;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.availability
      WHERE user_id = NEW.user_id
        AND date = v_run_end + 1
        AND location_status = 'away'
        AND trip_location IS NOT NULL
        AND public.normalize_trip_city(trip_location) = v_current_location
    );
    v_run_end := v_run_end + 1;
  END LOOP;

  -- Need 2+ consecutive days
  IF v_run_end - v_run_start < 1 THEN
    RETURN NEW;
  END IF;

  -- TIGHTENED DEDUPE: skip insert if ANY trip for this user+city overlaps the run by ±1 day
  IF EXISTS (
    SELECT 1 FROM public.trips
    WHERE user_id = NEW.user_id
      AND public.normalize_trip_city(location) = v_current_location
      AND start_date <= v_run_end + 1
      AND end_date   >= v_run_start - 1
  ) THEN
    -- Try to extend an existing overlapping trip to cover the run
    UPDATE public.trips
    SET start_date = LEAST(start_date, v_run_start),
        end_date   = GREATEST(end_date, v_run_end),
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND public.normalize_trip_city(location) = v_current_location
      AND start_date <= v_run_end + 1
      AND end_date   >= v_run_start - 1;
    RETURN NEW;
  END IF;

  -- Otherwise create new trip
  INSERT INTO public.trips (user_id, location, start_date, end_date)
  VALUES (NEW.user_id, NEW.trip_location, v_run_start, v_run_end);

  RETURN NEW;
END;
$function$;

-- 4) One-off cleanup of ghost duplicate trips
DELETE FROM public.trips t
WHERE t.proposal_id IS NULL
  AND COALESCE(array_length(t.priority_friend_ids, 1), 0) = 0
  AND NOT EXISTS (SELECT 1 FROM public.trip_participants tp WHERE tp.trip_id = t.id)
  AND EXISTS (
    SELECT 1 FROM public.trips t2
    WHERE t2.user_id = t.user_id
      AND t2.id <> t.id
      AND public.normalize_trip_city(t2.location) = public.normalize_trip_city(t.location)
      AND t2.start_date <= t.end_date
      AND t2.end_date   >= t.start_date
      AND (
        t2.proposal_id IS NOT NULL
        OR COALESCE(array_length(t2.priority_friend_ids, 1), 0) > 0
        OR EXISTS (SELECT 1 FROM public.trip_participants tp2 WHERE tp2.trip_id = t2.id)
        OR t2.created_at < t.created_at
      )
  );