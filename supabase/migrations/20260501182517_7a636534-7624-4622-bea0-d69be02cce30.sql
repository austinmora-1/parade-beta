-- Backfill availability.<slot> = false for every slot covered by an
-- existing confirmed / tentative / proposed plan. Multi-slot plans
-- (e.g. 5pm-8pm) block every slot they touch, not just their single
-- stored time_slot.

DO $$
DECLARE
  r RECORD;
  start_h NUMERIC;
  end_h NUMERIC;
  slot_starts INT[] := ARRAY[6, 9, 12, 15, 18, 22];
  slot_ends   INT[] := ARRAY[9, 12, 15, 18, 22, 26];
  slot_cols   TEXT[] := ARRAY[
    'early_morning','late_morning','early_afternoon',
    'late_afternoon','evening','late_night'
  ];
  i INT;
  date_only DATE;
  set_clause TEXT;
  cols_to_block TEXT[];
BEGIN
  FOR r IN
    SELECT id, user_id, date::date AS day, time_slot, start_time, end_time
    FROM public.plans
    WHERE status IN ('confirmed','tentative','proposed')
      AND date >= now() - interval '7 days'
  LOOP
    cols_to_block := ARRAY[]::TEXT[];

    IF r.start_time IS NOT NULL AND r.end_time IS NOT NULL THEN
      start_h := EXTRACT(HOUR FROM r.start_time) + EXTRACT(MINUTE FROM r.start_time)/60.0;
      end_h   := EXTRACT(HOUR FROM r.end_time)   + EXTRACT(MINUTE FROM r.end_time)/60.0;
      -- Treat end-before-start as crossing midnight into late-night
      IF end_h <= start_h THEN end_h := end_h + 24; END IF;

      FOR i IN 1..6 LOOP
        IF start_h < slot_ends[i] AND end_h > slot_starts[i] THEN
          cols_to_block := cols_to_block || slot_cols[i];
        END IF;
      END LOOP;
    ELSE
      -- Fall back to the stored single slot
      cols_to_block := ARRAY[ replace(r.time_slot, '-', '_') ];
    END IF;

    IF array_length(cols_to_block, 1) IS NULL THEN CONTINUE; END IF;

    -- Build "col1 = false, col2 = false, ..." for the upsert
    SELECT string_agg(quote_ident(c) || ' = false', ', ')
      INTO set_clause
      FROM unnest(cols_to_block) AS c;

    date_only := r.day;

    -- Ensure the row exists (default-true slots), then mark the covered ones false
    INSERT INTO public.availability (user_id, date)
    VALUES (r.user_id, date_only)
    ON CONFLICT (user_id, date) DO NOTHING;

    EXECUTE format(
      'UPDATE public.availability SET %s WHERE user_id = %L AND date = %L',
      set_clause, r.user_id, date_only
    );
  END LOOP;
END $$;
