
DELETE FROM public.plans
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id,
          public.normalize_plan_title_for_dedup(title),
          date::date,
          CASE WHEN start_time IS NOT NULL THEN substring(start_time::text FROM 1 FOR 5) ELSE NULL END
        ORDER BY created_at ASC
      ) AS rn
    FROM public.plans
    WHERE source IN ('gcal', 'ical', 'nylas')
  ) dupes
  WHERE rn > 1
);
