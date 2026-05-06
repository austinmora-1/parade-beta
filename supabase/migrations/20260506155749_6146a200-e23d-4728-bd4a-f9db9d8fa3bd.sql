-- Backfill: any availability slot currently marked busy (false) where the
-- only plans covering it are non-blocking (blocks_availability=false) should
-- be restored to true. Holidays like "Mother's Day" / "Cinco de Mayo" left
-- stale false flags from earlier syncs.

WITH slot_defs(slot_col, time_slot) AS (
  VALUES
    ('early_morning'::text,   'early-morning'::text),
    ('late_morning',          'late-morning'),
    ('early_afternoon',       'early-afternoon'),
    ('late_afternoon',        'late-afternoon'),
    ('evening',               'evening'),
    ('late_night',            'late-night')
),
-- For every (user, date, slot) currently false, check if any blocking plan
-- still claims that slot. If not, we can flip it back to true.
candidates AS (
  SELECT a.user_id, a.date, sd.slot_col, sd.time_slot
  FROM availability a
  CROSS JOIN slot_defs sd
  WHERE
    (sd.slot_col = 'early_morning'   AND a.early_morning   = false)
    OR (sd.slot_col = 'late_morning'    AND a.late_morning    = false)
    OR (sd.slot_col = 'early_afternoon' AND a.early_afternoon = false)
    OR (sd.slot_col = 'late_afternoon'  AND a.late_afternoon  = false)
    OR (sd.slot_col = 'evening'         AND a.evening         = false)
    OR (sd.slot_col = 'late_night'      AND a.late_night      = false)
),
to_clear AS (
  SELECT c.user_id, c.date, c.slot_col
  FROM candidates c
  WHERE NOT EXISTS (
    SELECT 1 FROM plans p
    WHERE p.user_id = c.user_id
      AND p.date::date = c.date
      AND COALESCE(p.blocks_availability, true) = true
      AND COALESCE(p.status, 'confirmed') IN ('confirmed','tentative','proposed')
      AND p.time_slot = c.time_slot
  )
)
UPDATE availability a
SET
  early_morning   = CASE WHEN EXISTS (SELECT 1 FROM to_clear t WHERE t.user_id=a.user_id AND t.date=a.date AND t.slot_col='early_morning')   THEN true ELSE a.early_morning   END,
  late_morning    = CASE WHEN EXISTS (SELECT 1 FROM to_clear t WHERE t.user_id=a.user_id AND t.date=a.date AND t.slot_col='late_morning')    THEN true ELSE a.late_morning    END,
  early_afternoon = CASE WHEN EXISTS (SELECT 1 FROM to_clear t WHERE t.user_id=a.user_id AND t.date=a.date AND t.slot_col='early_afternoon') THEN true ELSE a.early_afternoon END,
  late_afternoon  = CASE WHEN EXISTS (SELECT 1 FROM to_clear t WHERE t.user_id=a.user_id AND t.date=a.date AND t.slot_col='late_afternoon')  THEN true ELSE a.late_afternoon  END,
  evening         = CASE WHEN EXISTS (SELECT 1 FROM to_clear t WHERE t.user_id=a.user_id AND t.date=a.date AND t.slot_col='evening')         THEN true ELSE a.evening         END,
  late_night      = CASE WHEN EXISTS (SELECT 1 FROM to_clear t WHERE t.user_id=a.user_id AND t.date=a.date AND t.slot_col='late_night')      THEN true ELSE a.late_night      END
WHERE EXISTS (
  SELECT 1 FROM to_clear t WHERE t.user_id=a.user_id AND t.date=a.date
);