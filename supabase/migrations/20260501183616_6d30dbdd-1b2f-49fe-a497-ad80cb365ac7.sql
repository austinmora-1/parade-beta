-- =====================================================================
-- Cleanup stale availability data left over from the pre-coverage logic.
-- Step 1: Reset all per-slot "busy" flags back to true (free) within a
--         working window (past 7d → +6mo), but keep location/trip data.
-- Step 2: Re-block every slot that is genuinely covered by an active
--         (confirmed | tentative | proposed) plan, using full multi-slot
--         coverage from start_time/end_time.
-- =====================================================================

DO $$
DECLARE
  win_start DATE := (now() - interval '7 days')::date;
  win_end   DATE := (now() + interval '6 months')::date;
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
  -- Step 1: Wipe stale per-slot blocks in the working window.
  UPDATE public.availability
     SET early_morning   = true,
         late_morning    = true,
         early_afternoon = true,
         late_afternoon  = true,
         evening         = true,
         late_night      = true
   WHERE date BETWEEN win_start AND win_end;

  -- Step 2: Re-apply blocks from active plans within the same window.
  FOR r IN
    SELECT id, user_id, date::date AS day, time_slot, start_time, end_time
      FROM public.plans
     WHERE status IN ('confirmed','tentative','proposed')
       AND date::date BETWEEN win_start AND win_end
  LOOP
    cols_to_block := ARRAY[]::TEXT[];

    IF r.start_time IS NOT NULL AND r.end_time IS NOT NULL THEN
      start_h := EXTRACT(HOUR FROM r.start_time) + EXTRACT(MINUTE FROM r.start_time)/60.0;
      end_h   := EXTRACT(HOUR FROM r.end_time)   + EXTRACT(MINUTE FROM r.end_time)/60.0;
      IF end_h <= start_h THEN end_h := end_h + 24; END IF;

      FOR i IN 1..6 LOOP
        -- Only block fully-covered slots; partial overlaps stay "free"
        -- and the client-side coverage logic surfaces them as partial.
        IF start_h <= slot_starts[i] AND end_h >= slot_ends[i] THEN
          cols_to_block := cols_to_block || slot_cols[i];
        END IF;
      END LOOP;

      -- If the plan touches at least one slot but doesn't fully cover any,
      -- still mark its anchor slot busy so the legacy availability surface
      -- doesn't show it as wide-open.
      IF array_length(cols_to_block, 1) IS NULL THEN
        cols_to_block := ARRAY[ replace(r.time_slot, '-', '_') ];
      END IF;
    ELSE
      cols_to_block := ARRAY[ replace(r.time_slot, '-', '_') ];
    END IF;

    IF array_length(cols_to_block, 1) IS NULL THEN CONTINUE; END IF;

    SELECT string_agg(quote_ident(c) || ' = false', ', ')
      INTO set_clause
      FROM unnest(cols_to_block) AS c;

    date_only := r.day;

    INSERT INTO public.availability (user_id, date)
    VALUES (r.user_id, date_only)
    ON CONFLICT (user_id, date) DO NOTHING;

    EXECUTE format(
      'UPDATE public.availability SET %s WHERE user_id = %L AND date = %L',
      set_clause, r.user_id, date_only
    );
  END LOOP;
END $$;