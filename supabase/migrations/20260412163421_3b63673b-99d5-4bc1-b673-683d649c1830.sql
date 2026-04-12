-- Clean up existing content-duplicate flight plans
-- Keep the "best" plan (prefer non-null start_time, then oldest created_at)
-- Only delete plans without participants

DELETE FROM plans p1
USING plans p2
WHERE p1.user_id = p2.user_id
  AND p1.date = p2.date
  AND p1.id != p2.id
  -- Same normalized title
  AND normalize_plan_title_for_dedup(p1.title) = normalize_plan_title_for_dedup(p2.title)
  AND normalize_plan_title_for_dedup(p1.title) != ''
  -- Title contains at least one 3-letter word that could be an airport code
  -- (we check the normalized title matches flight pattern)
  AND normalize_plan_title_for_dedup(p1.title) ~ '\m[a-z]{2}\d+\s+[a-z]{3}\s'
  -- p1 is the "worse" duplicate: prefer p2 which has start_time or is older
  AND (
    (p1.start_time IS NULL AND p2.start_time IS NOT NULL)
    OR (p1.start_time IS NOT NULL AND p2.start_time IS NOT NULL AND p1.created_at > p2.created_at)
    OR (p1.start_time IS NULL AND p2.start_time IS NULL AND p1.created_at > p2.created_at)
  )
  -- Don't delete plans that have participants
  AND NOT EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = p1.id);