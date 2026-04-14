
-- Backfill source_timezone for plans where it's NULL
-- Step 1: Set from explicit profile timezone
UPDATE public.plans p
SET source_timezone = pr.timezone
FROM public.profiles pr
WHERE p.user_id = pr.user_id
  AND p.source_timezone IS NULL
  AND pr.timezone IS NOT NULL
  AND pr.timezone != '';

-- Step 2: Set from home_address using city-to-timezone mapping for remaining NULLs
WITH city_tz_map(city, tz) AS (VALUES
  ('new york', 'America/New_York'), ('nyc', 'America/New_York'), ('brooklyn', 'America/New_York'),
  ('boston', 'America/New_York'), ('philadelphia', 'America/New_York'), ('washington', 'America/New_York'),
  ('miami', 'America/New_York'), ('atlanta', 'America/New_York'), ('detroit', 'America/New_York'),
  ('nashville', 'America/New_York'), ('charlotte', 'America/New_York'), ('orlando', 'America/New_York'),
  ('pittsburgh', 'America/New_York'), ('baltimore', 'America/New_York'), ('cleveland', 'America/New_York'),
  ('columbus', 'America/New_York'), ('indianapolis', 'America/New_York'), ('tampa', 'America/New_York'),
  ('raleigh', 'America/New_York'), ('hoboken', 'America/New_York'), ('jersey city', 'America/New_York'),
  ('chicago', 'America/Chicago'), ('houston', 'America/Chicago'), ('dallas', 'America/Chicago'),
  ('austin', 'America/Chicago'), ('san antonio', 'America/Chicago'), ('minneapolis', 'America/Chicago'),
  ('milwaukee', 'America/Chicago'), ('kansas city', 'America/Chicago'), ('st. louis', 'America/Chicago'),
  ('new orleans', 'America/Chicago'), ('memphis', 'America/Chicago'), ('oklahoma city', 'America/Chicago'),
  ('denver', 'America/Denver'), ('salt lake city', 'America/Denver'), ('albuquerque', 'America/Denver'),
  ('boulder', 'America/Denver'), ('colorado springs', 'America/Denver'), ('boise', 'America/Denver'),
  ('phoenix', 'America/Phoenix'), ('scottsdale', 'America/Phoenix'), ('tucson', 'America/Phoenix'),
  ('los angeles', 'America/Los_Angeles'), ('san francisco', 'America/Los_Angeles'), ('san diego', 'America/Los_Angeles'),
  ('seattle', 'America/Los_Angeles'), ('portland', 'America/Los_Angeles'), ('las vegas', 'America/Los_Angeles'),
  ('sacramento', 'America/Los_Angeles'), ('oakland', 'America/Los_Angeles'), ('san jose', 'America/Los_Angeles'),
  ('palo alto', 'America/Los_Angeles'), ('irvine', 'America/Los_Angeles'), ('santa monica', 'America/Los_Angeles'),
  ('honolulu', 'Pacific/Honolulu'), ('anchorage', 'America/Anchorage'),
  ('london', 'Europe/London'), ('paris', 'Europe/Paris'), ('berlin', 'Europe/Berlin'),
  ('tokyo', 'Asia/Tokyo'), ('sydney', 'Australia/Sydney'), ('toronto', 'America/Toronto'),
  ('vancouver', 'America/Vancouver'), ('mexico city', 'America/Mexico_City')
),
matched AS (
  SELECT DISTINCT ON (p.id) p.id AS plan_id, cm.tz
  FROM public.plans p
  JOIN public.profiles pr ON p.user_id = pr.user_id
  JOIN city_tz_map cm ON lower(pr.home_address) LIKE '%' || cm.city || '%'
  WHERE p.source_timezone IS NULL
    AND pr.home_address IS NOT NULL
  ORDER BY p.id, length(cm.city) DESC
)
UPDATE public.plans p
SET source_timezone = m.tz
FROM matched m
WHERE p.id = m.plan_id;

-- Step 3: Set remaining NULLs to America/New_York as fallback
UPDATE public.plans
SET source_timezone = 'America/New_York'
WHERE source_timezone IS NULL;
