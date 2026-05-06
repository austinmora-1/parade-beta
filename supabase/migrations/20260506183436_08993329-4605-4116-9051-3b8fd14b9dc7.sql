-- Mark existing imported all-day calendar events as non-blocking
UPDATE plans
SET blocks_availability = false
WHERE source IN ('gcal', 'ical', 'google', 'apple', 'nylas', 'outlook')
  AND start_time IS NULL
  AND blocks_availability = true;

-- Restore availability slots that were ONLY blocked by all-day calendar events.
WITH affected AS (
  SELECT DISTINCT p.user_id, (p.date AT TIME ZONE 'UTC')::date AS d
  FROM plans p
  WHERE p.source IN ('gcal','ical','google','apple','nylas','outlook')
    AND p.start_time IS NULL
), still_blocked AS (
  SELECT a.user_id, a.d
  FROM affected a
  WHERE EXISTS (
    SELECT 1 FROM plans p2
    WHERE p2.user_id = a.user_id
      AND (p2.date AT TIME ZONE 'UTC')::date = a.d
      AND p2.blocks_availability = true
      AND p2.start_time IS NOT NULL
  )
)
UPDATE availability av
SET early_morning = true,
    late_morning = true,
    early_afternoon = true,
    late_afternoon = true,
    evening = true,
    late_night = true,
    updated_at = now()
FROM affected a
WHERE av.user_id = a.user_id
  AND av.date = a.d
  AND NOT EXISTS (
    SELECT 1 FROM still_blocked sb WHERE sb.user_id = a.user_id AND sb.d = a.d
  );