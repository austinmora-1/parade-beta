

## Fix: All-Day Calendar Events Showing on Wrong Date

### Root Cause

The bug has two parts, both in the calendar sync functions:

1. **Wrong date**: When syncing all-day events, `new Date("2026-07-04")` creates midnight UTC. Then `getDateString()` converts this to the user's timezone (e.g. `America/Chicago`), which shifts midnight UTC to 7pm the previous day — so July 4 becomes July 3 in the database.

2. **Wrong time slot**: All-day events default to `hour = 8`, which maps to `early-morning`. All-day events should use a more neutral slot or be clearly marked.

The display code in `plannerStore.ts` (lines 1560-1564) correctly uses UTC parts, so fixing the sync is sufficient.

### Fix

**Files to change**: 
- `supabase/functions/_shared/calendar-helpers.ts`
- `supabase/functions/google-calendar-sync/index.ts`
- `supabase/functions/calendar-sync-worker/index.ts`
- `supabase/functions/ical-sync/index.ts`

**Changes**:

1. **In all three sync functions** (google-calendar-sync, calendar-sync-worker, ical-sync): When an event is all-day (`event.start.date` without `dateTime`), parse the date string directly instead of using `new Date()`. Extract year/month/day from the `"YYYY-MM-DD"` string and construct the `planDate` as `"YYYY-MM-DDT12:00:00+00:00"` without going through timezone conversion. This prevents the UTC-midnight-to-local shift.

2. **Change the default time slot** for all-day events from `early-morning` (hour 8) to `early-afternoon` (hour 12) or a dedicated "all-day" representation, so they don't appear as 6am events.

3. **Fix existing bad data**: After deploying, trigger a re-sync so existing mis-dated plans get corrected. No migration needed since re-sync will overwrite via `source_event_id` reconciliation.

### Technical Detail

```text
Before (buggy):
  event.start.date = "2026-07-04"
  → new Date("2026-07-04") = 2026-07-04T00:00:00Z
  → getDateString(..., "America/Chicago") = "2026-07-03"  ← WRONG
  → planDate = "2026-07-03T12:00:00+00:00"

After (fixed):
  event.start.date = "2026-07-04"
  → parse directly: localDateStr = "2026-07-04"
  → planDate = "2026-07-04T12:00:00+00:00"  ← CORRECT
```

The same fix applies to the availability slot computation for all-day events (the `busySlotsByDate` loop), where `getEventDates` also receives a midnight-UTC date that can shift to the wrong local day.
