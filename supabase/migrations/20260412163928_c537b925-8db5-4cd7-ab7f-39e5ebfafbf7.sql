
-- Delete all content-duplicate plans, keeping the "best" one per group
-- Best = has start_time (prefer non-null), then oldest by id
-- Use a CTE to identify the keepers
WITH ranked AS (
  SELECT id,
         user_id,
         date::date AS plan_date,
         normalize_plan_title_for_dedup(title) AS norm_title,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, date::date, normalize_plan_title_for_dedup(title)
           ORDER BY
             CASE WHEN start_time IS NOT NULL THEN 0 ELSE 1 END,
             created_at ASC,
             id ASC
         ) AS rn
  FROM plans
  WHERE normalize_plan_title_for_dedup(title) != ''
),
to_delete AS (
  SELECT r.id
  FROM ranked r
  WHERE r.rn > 1
    AND NOT EXISTS (SELECT 1 FROM plan_participants pp WHERE pp.plan_id = r.id)
)
DELETE FROM plans WHERE id IN (SELECT id FROM to_delete);
