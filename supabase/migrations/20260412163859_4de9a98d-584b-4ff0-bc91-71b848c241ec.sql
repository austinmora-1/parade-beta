
-- Step 1: Clean up exact content duplicates (same normalized title, same date, same start_time)
-- Keep the oldest plan, delete newer duplicates without participants
DELETE FROM plans p1
USING plans p2
WHERE p1.user_id = p2.user_id
  AND p1.date::date = p2.date::date
  AND p1.id != p2.id
  AND normalize_plan_title_for_dedup(p1.title) = normalize_plan_title_for_dedup(p2.title)
  AND normalize_plan_title_for_dedup(p1.title) != ''
  AND COALESCE(p1.start_time::text, '') = COALESCE(p2.start_time::text, '')
  AND p1.created_at > p2.created_at
  AND NOT EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = p1.id);

-- Step 2: Clean up flight duplicates where start_time differs (cross-calendar timezone mismatch)
-- For titles matching flight patterns (contain 2+ airport codes), ignore start_time
DELETE FROM plans p1
USING plans p2
WHERE p1.user_id = p2.user_id
  AND p1.date::date = p2.date::date
  AND p1.id != p2.id
  AND normalize_plan_title_for_dedup(p1.title) = normalize_plan_title_for_dedup(p2.title)
  AND normalize_plan_title_for_dedup(p1.title) != ''
  -- Flight pattern: airline code + number + airport codes
  AND normalize_plan_title_for_dedup(p1.title) ~ '\m[a-z]{2,3}\d+\M.*\m[a-z]{3}\s'
  -- p1 is the worse duplicate
  AND (
    (p1.start_time IS NULL AND p2.start_time IS NOT NULL)
    OR (p1.start_time IS NOT NULL AND p2.start_time IS NOT NULL AND p1.created_at > p2.created_at)
    OR (p1.start_time IS NULL AND p2.start_time IS NULL AND p1.created_at > p2.created_at)
  )
  AND NOT EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = p1.id);
