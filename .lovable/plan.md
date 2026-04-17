

## Root cause

The `calendar-sync-worker` (the **background cron job that runs every 2 hours**) has its own copy of sync logic that **ignores per-event timezones**:

**iCal worker (lines 364–388 of `calendar-sync-worker/index.ts`):**
- `getDateString(event.dtstart)` — no timezone arg → uses UTC for the date
- `event.dtstart.getUTCHours()` — UTC hour for the time slot
- `formatTimeHHMM(event.dtstart, userTimezone)` — viewer's TZ for the HH:MM
- `source_timezone: userTimezone` — viewer's TZ stored, ignoring `event.tzid`

The on-demand `ical-sync` was already fixed (line 217: `event.tzid || userTimezone`) — but the worker wasn't, so every 2 hours the cron overwrites it back to `2026-04-17 / 21:30 NY`.

**Verified from the iCal feed:** the actual event is `DTSTART;TZID=America/Los_Angeles:20260416T183000` — should be stored as `date=2026-04-16, start_time=18:30, source_timezone=America/Los_Angeles`.

The Google worker has the same class of bug — it always uses the viewer's timezone instead of the event's own timezone (Google returns `start.timeZone` per event, plus `start.dateTime` includes an offset).

## Fix

### 1. `supabase/functions/calendar-sync-worker/index.ts` — iCal section (lines 364–388)

Mirror the on-demand `ical-sync` logic exactly:
- `eventTimezone = (!event.isAllDay && event.tzid) ? event.tzid : userTimezone`
- Use `eventTimezone` for `getDateString`, `getHourInTimezone`, `formatTimeHHMM`, and `source_timezone`.

### 2. `supabase/functions/calendar-sync-worker/index.ts` — Google section (lines 243–275)

Apply per-event timezone:
- `eventTimezone = event.start.timeZone || timezone`
- Use it for `getDateString`, `getHourInTimezone`, `formatTimeHHMM`, and `source_timezone`.

### 3. `supabase/functions/google-calendar-sync/index.ts` — same per-event TZ fix (lines 142–172)

Same pattern — prefer `event.start.timeZone` over the viewer's `timezone`.

### 4. `supabase/functions/_shared/calendar-helpers.ts` — extend `CalendarEvent`

Add the optional fields Google already returns (currently dropped):
```ts
export interface CalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end:   { dateTime?: string; date?: string; timeZone?: string }
  location?: string
}
```

### 5. One-shot DB cleanup

Trigger an immediate `ical-sync` after deploy (the user can do this via the existing "Sync now" button in Calendar Integration). This will rewrite the Docklands plan with the correct LA timezone, and from then on the cron worker will no longer corrupt it.

## Why this fully fixes the symptom

- The event's true local time (PDT) is now the source of truth at write-time, regardless of which sync path runs (foreground, cron, Google, iCal).
- `source_timezone` correctly stores the **event's** zone, not the **viewer's**, so the client converts properly when rendering for any viewer in any location.
- The two-hour cron will no longer "revert" anything, because both paths now produce identical values.

## Files touched

- `supabase/functions/calendar-sync-worker/index.ts` — apply per-event TZ for both iCal and Google
- `supabase/functions/google-calendar-sync/index.ts` — apply per-event TZ
- `supabase/functions/_shared/calendar-helpers.ts` — add `timeZone?: string` to `CalendarEvent`

## Verification

1. Deploy → click "Sync now" in Calendar Integration → Docklands plan moves to **Thu Apr 16, 6:30 PM PDT** (displayed as 9:30 PM ET if viewer is in NY, or 6:30 PM PT if viewer is in Redwood City).
2. Wait for the 2-hour cron → plan stays on Apr 16 — no revert.
3. Repeat for the JFK→SFO Delta flight (which has `TZID=America/New_York`): should show 3:20 PM ET / 12:20 PM PT, on April 13. No drift after cron.

