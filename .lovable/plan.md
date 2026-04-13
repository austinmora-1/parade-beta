

## Fix: Missing Dallas Flight (UA1062) Not Syncing

### Root Cause

The UA1062 SFO→DFW flight on April 17 was never imported into the database. There are zero records for April 17-21 in plans, availability, or trips. Two likely causes:

1. **Sync timing**: The last automated sync ran before the pagination fix was deployed, so the event may have been cut off at the 250-event limit
2. **Non-primary calendar**: If the flight is on a secondary Google Calendar (e.g., "Travel"), it won't be synced — the system only queries `calendars/primary/events`

### Plan

#### Step 1: Trigger a fresh sync for your account
Manually invoke the `calendar-sync-worker` edge function for your user ID + Google provider. This will use the new pagination logic and should pick up the flight if it's on the primary calendar.

#### Step 2: Add multi-calendar support
Update `fetchAllGoogleEvents` in `calendar-helpers.ts` to:
- First call `calendarList` API to get all user calendars
- Fetch events from each calendar (not just `primary`)
- Deduplicate across calendars by event ID

This ensures flights on secondary/travel calendars are captured.

#### Step 3: Add sync logging
Add structured console.log statements to the sync worker so we can verify which events are fetched, which are skipped, and why — making future debugging much faster.

### Technical Details

- `fetchAllGoogleEvents` currently hardcodes `calendars/primary/events`
- Google Calendar API supports `calendarList` endpoint to enumerate all calendars
- Events from different calendars can have different IDs, so dedup needs to account for this
- The `calendar-sync-worker` and `google-calendar-sync` functions both use the shared helper, so fixing it once fixes both paths

