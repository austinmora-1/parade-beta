-- Fix Austin's overlapping trips for April 2026
-- Austin (user_id = 30279b3f-657b-49cf-b38a-bd0d042172f2) has:
-- Redwood City Apr 12-24 → should end Apr 16 (day before Dallas flight)
-- San Francisco Apr 13-24 → should end Apr 16
-- Dallas Apr 17-24 needs_return_date → should end Apr 25 (return flight AA1380 to JFK)

UPDATE trips SET end_date = '2026-04-16', updated_at = now()
WHERE id = 'eab75434-4e0b-4214-8937-7e7f43163cd5'
  AND user_id = '30279b3f-657b-49cf-b38a-bd0d042172f2';

UPDATE trips SET end_date = '2026-04-16', updated_at = now()
WHERE id = '2aed8f3f-9311-4d88-9607-cf0a3c5e6782'
  AND user_id = '30279b3f-657b-49cf-b38a-bd0d042172f2';

UPDATE trips SET end_date = '2026-04-25', needs_return_date = false, updated_at = now()
WHERE id = '9741db9f-6cc3-4a92-8b7e-822aa23ee368'
  AND user_id = '30279b3f-657b-49cf-b38a-bd0d042172f2';

-- Fix availability: Apr 17-24 should be Dallas, Apr 25 should be home
UPDATE availability SET trip_location = 'Dallas', location_status = 'away', updated_at = now()
WHERE user_id = '30279b3f-657b-49cf-b38a-bd0d042172f2'
  AND date BETWEEN '2026-04-17' AND '2026-04-24';

UPDATE availability SET trip_location = NULL, location_status = 'home', updated_at = now()
WHERE user_id = '30279b3f-657b-49cf-b38a-bd0d042172f2'
  AND date = '2026-04-25';