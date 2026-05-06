## Goal
Ensure all-day calendar-imported events (Google, iCal, future Nylas) never block availability slots — they appear on the calendar/day view but show the day as free.

## What's already correct
- `supabase/functions/ical-sync/index.ts` — already skips slot busies for all-day events and sets `blocks_availability: !event.isAllDay` on the plan row.
- `supabase/functions/google-calendar-sync/index.ts` — same: skips slot busies and sets `blocks_availability: !isAllDay`.

## What's broken (the cron worker)
`supabase/functions/calendar-sync-worker/index.ts` is the function pg_cron runs every 2 hours. It still:
1. Marks all 6 time slots as busy for every all-day event (Google: lines ~63–70; iCal: lines ~156–163).
2. Never writes `blocks_availability` on the plan rows it upserts (Google branch ~387–399; iCal branch ~560–574), so all-day events default to `blocks_availability = true`.

This means every cron tick re-blocks holidays/birthdays even after manual fixes.

## Changes

### 1. `supabase/functions/calendar-sync-worker/index.ts`
- In `collectGoogleFlightsAndHotels` (all-day branch): remove the `[early_morning…late_night].forEach(...)` block that adds 6 slot busies. Keep the `busySlotsByDate.set(date, new Set())` so the date is part of the sync range.
- In `collectICalFlightsAndHotels` (all-day branch): same removal.
- In the Google plan-row upsert: add `blocks_availability: !isAllDay` (track `isAllDay` like `google-calendar-sync` already does — set true when taking the `event.start.date` branch).
- In the iCal plan-row upsert: add `blocks_availability: !event.isAllDay`.

Flight/hotel detection inside all-day events stays untouched, so trip auto-creation continues to work.

### 2. New migration `supabase/migrations/<ts>_unblock_all_day_calendar_events.sql`
Two operations, both scoped to existing calendar-imported all-day plans:

```sql
-- A. Mark all existing imported all-day events as non-blocking
UPDATE plans
SET blocks_availability = false
WHERE source IN ('gcal', 'ical', 'google', 'apple', 'nylas', 'outlook')
  AND start_time IS NULL
  AND blocks_availability = true;

-- B. Restore availability slots that were ONLY blocked by those all-day events.
-- For each (user_id, date) that has at least one all-day calendar plan and no
-- other plan with blocks_availability=true on that local date, reset all 6
-- slots to true.
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
SET early_morning = true, late_morning = true, early_afternoon = true,
    late_afternoon = true, evening = true, late_night = true,
    updated_at = now()
FROM affected a
WHERE av.user_id = a.user_id
  AND av.date = a.d
  AND NOT EXISTS (SELECT 1 FROM still_blocked sb WHERE sb.user_id = a.user_id AND sb.d = a.d);
```

This will not touch any day where a real timed plan still blocks availability, so manual edits and legitimate busy days are preserved.

### 3. Deploy
Redeploy `calendar-sync-worker`, `google-calendar-sync`, `ical-sync` so the next sync (manual or cron) keeps the fix in place.

## Out of scope
- `nylas-sync` — verify in a follow-up; the user has not enabled Nylas yet.
- Native (parade) all-day plans continue to default to `blocks_availability = true`; only calendar-sourced imports change.
