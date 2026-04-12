
-- Helper function for title normalization (matching edge function logic)
CREATE OR REPLACE FUNCTION public.normalize_plan_title_for_dedup(title text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  t text;
BEGIN
  IF title IS NULL OR trim(title) = '' THEN
    RETURN '';
  END IF;
  t := lower(trim(title));
  -- Remove "flight" prefix (with optional "N of M |")
  t := regexp_replace(t, '^flight\s*(\d+\s*of\s*\d+\s*\|?\s*)?', '', 'i');
  -- Remove pipe separators
  t := replace(t, '|', ' ');
  -- Remove leading zeros from flight numbers (e.g., dl0679 → dl679)
  t := regexp_replace(t, '([a-z]{2})0+(\d)', '\1\2', 'gi');
  -- Collapse whitespace
  t := regexp_replace(t, '\s+', ' ', 'g');
  t := trim(t);
  RETURN t;
END;
$$;

-- Delete content-based duplicates (same normalized title + date + start_time),
-- keeping the oldest record, skipping plans with participants
DELETE FROM plans p1
USING plans p2
WHERE p1.user_id = p2.user_id
  AND p1.date = p2.date
  AND COALESCE(p1.start_time::text, '') = COALESCE(p2.start_time::text, '')
  AND normalize_plan_title_for_dedup(p1.title) = normalize_plan_title_for_dedup(p2.title)
  AND normalize_plan_title_for_dedup(p1.title) != ''
  AND p1.id != p2.id
  AND p1.created_at > p2.created_at
  AND NOT EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = p1.id);
