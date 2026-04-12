
CREATE OR REPLACE FUNCTION public.auto_create_trip_from_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_home_address TEXT;
  v_run_start DATE;
  v_run_end DATE;
  v_current_location TEXT;
  v_prev_location TEXT;
  v_prev_date DATE;
  rec RECORD;
BEGIN
  -- Only act when location_status is 'away' and trip_location is set
  IF NEW.location_status != 'away' OR NEW.trip_location IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user's home address to skip home-like locations
  SELECT home_address INTO v_home_address FROM public.profiles WHERE user_id = NEW.user_id;

  -- Skip if the trip location matches home
  IF v_home_address IS NOT NULL THEN
    DECLARE
      v_norm_trip TEXT := lower(trim(NEW.trip_location));
      v_norm_home TEXT := lower(trim(v_home_address));
      v_trip_city TEXT;
      v_home_city TEXT;
    BEGIN
      v_trip_city := trim(regexp_replace(split_part(v_norm_trip, ',', 1), '\s*(city|town|village)$', '', 'i'));
      v_home_city := trim(regexp_replace(split_part(v_norm_home, ',', 1), '\s*(city|town|village)$', '', 'i'));
      IF v_norm_home LIKE '%' || v_norm_trip || '%' OR v_norm_trip LIKE '%' || v_norm_home || '%' THEN
        RETURN NEW;
      END IF;
      IF v_trip_city != '' AND v_home_city != '' AND (v_trip_city LIKE '%' || v_home_city || '%' OR v_home_city LIKE '%' || v_trip_city || '%') THEN
        RETURN NEW;
      END IF;
    END;
  END IF;

  -- Scan all consecutive away days for this user around the changed date with the same location
  -- Find the run of consecutive away days with the same trip_location that includes NEW.date
  v_run_start := NEW.date;
  v_run_end := NEW.date;
  v_current_location := lower(trim(NEW.trip_location));

  -- Expand backward
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.availability
      WHERE user_id = NEW.user_id
        AND date = v_run_start - 1
        AND location_status = 'away'
        AND trip_location IS NOT NULL
        AND lower(trim(trip_location)) = v_current_location
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
        AND lower(trim(trip_location)) = v_current_location
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
      AND lower(trim(location)) = v_current_location
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
    AND lower(trim(location)) = v_current_location
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
$$;

CREATE TRIGGER trg_auto_create_trip_from_availability
AFTER INSERT OR UPDATE ON public.availability
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_trip_from_availability();
