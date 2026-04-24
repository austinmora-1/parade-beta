-- Tests for public.get_conflicting_trips
-- Verifies that ONLY true date-range overlaps are flagged, and that
-- "touching" ranges (one trip ends the day before the next begins) are NOT.
--
-- Run with:  psql -v ON_ERROR_STOP=1 -f supabase/tests/get_conflicting_trips.test.sql
-- Wrapped in a transaction + ROLLBACK so no data persists.

BEGIN;

-- Isolated synthetic user
DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_today date := CURRENT_DATE;
  v_palma uuid;
  v_athens uuid;
  v_overlap_a uuid;
  v_overlap_b uuid;
  v_contained_a uuid;
  v_contained_b uuid;
  v_far uuid;
  v_past_a uuid;
  v_past_b uuid;
  v_count int;
BEGIN
  -- Touching: Palma ends day N, Athens starts day N+1  -> NOT a conflict
  INSERT INTO public.trips(user_id, location, start_date, end_date)
  VALUES (v_user, 'Palma',  v_today + 30, v_today + 32) RETURNING id INTO v_palma;
  INSERT INTO public.trips(user_id, location, start_date, end_date)
  VALUES (v_user, 'Athens', v_today + 33, v_today + 36) RETURNING id INTO v_athens;

  -- True overlap: shares 1+ day -> IS a conflict
  INSERT INTO public.trips(user_id, location, start_date, end_date)
  VALUES (v_user, 'Rome',   v_today + 50, v_today + 55) RETURNING id INTO v_overlap_a;
  INSERT INTO public.trips(user_id, location, start_date, end_date)
  VALUES (v_user, 'Milan',  v_today + 55, v_today + 60) RETURNING id INTO v_overlap_b;

  -- Fully contained -> IS a conflict
  INSERT INTO public.trips(user_id, location, start_date, end_date)
  VALUES (v_user, 'Tokyo',  v_today + 70, v_today + 80) RETURNING id INTO v_contained_a;
  INSERT INTO public.trips(user_id, location, start_date, end_date)
  VALUES (v_user, 'Kyoto',  v_today + 73, v_today + 76) RETURNING id INTO v_contained_b;

  -- Far apart -> NOT a conflict
  INSERT INTO public.trips(user_id, location, start_date, end_date)
  VALUES (v_user, 'Lisbon', v_today + 100, v_today + 105) RETURNING id INTO v_far;

  -- Past trips that overlap -> excluded by end_date >= CURRENT_DATE filter
  INSERT INTO public.trips(user_id, location, start_date, end_date)
  VALUES (v_user, 'OldA', v_today - 30, v_today - 20) RETURNING id INTO v_past_a;
  INSERT INTO public.trips(user_id, location, start_date, end_date)
  VALUES (v_user, 'OldB', v_today - 25, v_today - 15) RETURNING id INTO v_past_b;

  -- ===== Assertions =====

  -- 1) Touching ranges (Palma/Athens) MUST NOT appear
  SELECT COUNT(*) INTO v_count
  FROM public.get_conflicting_trips(v_user)
  WHERE (trip_a_id = v_palma  AND trip_b_id = v_athens)
     OR (trip_a_id = v_athens AND trip_b_id = v_palma);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: touching ranges (Palma end=N, Athens start=N+1) flagged as conflict (got % rows)', v_count;
  END IF;

  -- 2) True overlap (Rome/Milan share day +55) MUST appear
  SELECT COUNT(*) INTO v_count
  FROM public.get_conflicting_trips(v_user)
  WHERE (trip_a_id = v_overlap_a AND trip_b_id = v_overlap_b)
     OR (trip_a_id = v_overlap_b AND trip_b_id = v_overlap_a);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: true overlap (Rome/Milan) not flagged exactly once (got % rows)', v_count;
  END IF;

  -- 3) Contained range (Kyoto inside Tokyo) MUST appear
  SELECT COUNT(*) INTO v_count
  FROM public.get_conflicting_trips(v_user)
  WHERE (trip_a_id = v_contained_a AND trip_b_id = v_contained_b)
     OR (trip_a_id = v_contained_b AND trip_b_id = v_contained_a);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: contained range (Tokyo/Kyoto) not flagged exactly once (got % rows)', v_count;
  END IF;

  -- 4) Far-apart trip (Lisbon) MUST NOT appear in any pair
  SELECT COUNT(*) INTO v_count
  FROM public.get_conflicting_trips(v_user)
  WHERE trip_a_id = v_far OR trip_b_id = v_far;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: far-apart trip (Lisbon) appeared in conflicts (got % rows)', v_count;
  END IF;

  -- 5) Past overlapping trips MUST NOT appear (end_date < today filter)
  SELECT COUNT(*) INTO v_count
  FROM public.get_conflicting_trips(v_user)
  WHERE trip_a_id IN (v_past_a, v_past_b) OR trip_b_id IN (v_past_a, v_past_b);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: past overlapping trips appeared in conflicts (got % rows)', v_count;
  END IF;

  -- 6) Total conflicts for this user should be exactly 2 (Rome/Milan + Tokyo/Kyoto)
  SELECT COUNT(*) INTO v_count FROM public.get_conflicting_trips(v_user);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected exactly 2 conflict rows for user, got %', v_count;
  END IF;

  -- 7) Same-day boundary: trip ends exactly on day another starts -> shared day, IS conflict
  DECLARE
    v_share_a uuid;
    v_share_b uuid;
  BEGIN
    INSERT INTO public.trips(user_id, location, start_date, end_date)
    VALUES (v_user, 'ShareA', v_today + 200, v_today + 205) RETURNING id INTO v_share_a;
    INSERT INTO public.trips(user_id, location, start_date, end_date)
    VALUES (v_user, 'ShareB', v_today + 205, v_today + 210) RETURNING id INTO v_share_b;

    SELECT COUNT(*) INTO v_count
    FROM public.get_conflicting_trips(v_user)
    WHERE (trip_a_id = v_share_a AND trip_b_id = v_share_b)
       OR (trip_a_id = v_share_b AND trip_b_id = v_share_a);
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'FAIL: trips sharing one boundary day not flagged (got % rows)', v_count;
    END IF;
  END;

  RAISE NOTICE 'PASS: get_conflicting_trips correctly identifies only true date overlaps';
END $$;

ROLLBACK;
