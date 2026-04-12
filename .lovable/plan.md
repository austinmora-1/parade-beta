

# Fix Plan Deduplication: Root Cause & Solution

## Root Cause Analysis

Investigating the real duplicate — `DL0679 | JFK to SFO` on Apr 13:

| Field | Plan 1 (manual/gcal display) | Plan 2 (iCal sync) |
|---|---|---|
| title | `DL0679 \| JFK to SFO` | `Flight  DL679 JFK to SFO` |
| source | `null` | `ical` |
| start_time | `15:20:00` | `null` |
| created_at | 13:56 | 16:00 |

The content-based dedup key is `normalizedTitle|date|start_time`. Both titles normalize to `dl679 jfk to sfo` correctly, but the keys diverge because **start_time differs** — one has `15:20:00`, the other is `null` (iCal treats this flight as an all-day event).

### Three distinct bugs causing duplicates:

1. **start_time mismatch in dedup key** — When the same event appears as a timed event in one source and an all-day event in another (or no source at all), the `start_time` component of the dedup key prevents matching. This is the primary bug.

2. **Cross-source blindness** — The first plan has `source=null` (created manually or via the Google Calendar events UI, not the sync function). The iCal sync's content dedup does check all plans regardless of source, but fails due to issue #1.

3. **iCal all-day flight events lose start_time** — When iCal provides a flight as an all-day event (`VALUE=DATE`), the sync sets `start_time=null`, losing the specific departure time that Google Calendar preserves.

## Plan

### 1. Make content dedup key ignore start_time for flight events

In both `google-calendar-sync/index.ts` and `ical-sync/index.ts`, when building the content dedup key, use **only `normalizedTitle|date`** (without start_time) when the normalized title matches a flight pattern (contains airport codes). This prevents all-day vs timed mismatches from creating duplicates.

For non-flight events, keep the full key `normalizedTitle|date|start_time` to avoid false dedup of genuinely different events at different times.

### 2. When content-match found, prefer the plan with more data

Currently when a content match is found, the sync just links the `source_event_id`. Update this to also merge useful fields: if the existing plan has `start_time` but the incoming doesn't (or vice versa), keep the more specific value. This ensures we don't lose departure times.

### 3. Clean up existing duplicate flight plans

Run a one-time migration to delete content-duplicate flight plans (same user, same date, same normalized title containing airport codes), keeping the one with the most data (non-null start_time preferred, oldest as tiebreaker).

### 4. Fix double-space in iCal flight title parsing

The iCal-synced title `"Flight  DL679 JFK to SFO"` has a double space. This is cosmetic but the `normalizePlanTitle` function already collapses whitespace so it doesn't affect dedup — however it should still be fixed for display quality by trimming/collapsing the title during ICS parsing.

## Files to modify

- `supabase/functions/google-calendar-sync/index.ts` — flight-aware dedup key logic
- `supabase/functions/ical-sync/index.ts` — flight-aware dedup key logic  
- `supabase/functions/calendar-sync-worker/index.ts` — same changes if it has its own sync logic
- New SQL migration — cleanup existing duplicates

## Technical Detail

```text
Current dedup key:  "dl679 jfk to sfo|2026-04-13T12:00:00+00:00|15:20:00"
                    "dl679 jfk to sfo|2026-04-13T12:00:00+00:00|"
                    → NO MATCH (start_time differs)

Proposed dedup key for flights:
                    "dl679 jfk to sfo|2026-04-13T12:00:00+00:00"
                    "dl679 jfk to sfo|2026-04-13T12:00:00+00:00"
                    → MATCH ✓
```

Flight detection for the dedup key: check if the normalized title contains two 3-letter airport codes from the existing `AIRPORT_CITY_MAP`, reusing the `isFlightEvent` function already present in both files.

