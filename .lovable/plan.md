

## Root Cause Analysis: Triple Flight Duplication

### The 3 duplicates

| # | Source | Title | Normalized | `manually_edited` |
|---|--------|-------|------------|-------------------|
| 1 | manual (no source) | `Flight to SFO (DL 679)` | `to sfo (dl 679)` | `true` |
| 2 | iCal | `DL0679 \| JFK to SFO` | `dl679 jfk to sfo` | `false` |
| 3 | gcal | `Flight to SFO (DL 679)` | `to sfo (dl 679)` | `false` |

### Why dedup misses each pair

**Manual (#1) vs iCal (#2):** Completely different normalized titles. No source_event_id overlap. Content keys never match.

**Manual (#1) vs gcal (#3):** Same normalized title, but #1 has no source_event_id so Layer 1 skips it. Layer 2 content key matches, but the merge logic only patches metadata onto #1 (adds source_event_id) — it doesn't prevent inserting #3 because #1 is `manually_edited` and the logic continues to insert.

**iCal (#2) vs gcal (#3):** Different normalized titles (`dl679 jfk to sfo` vs `to sfo (dl 679)`). Content keys never match. Different source_event_ids. Both get inserted.

### Root Problem

The content-based dedup relies on exact normalized title match, but airlines format flight titles inconsistently:
- Apple Calendar: `DL0679 | JFK to SFO`
- Google Calendar: `Flight to SFO (DL 679)`

The title normalizer strips "Flight" prefixes and pipes, but the resulting strings are still structurally different. **What they share is a flight number (`DL679`) and a date** — that's the real identity of a flight.

### Fix: Flight-Aware Content Key

When a title contains a recognizable flight number (airline code + digits), extract it and use `flightNumber|date` as the content key instead of the full normalized title.

#### Detailed changes in `supabase/functions/_shared/calendar-helpers.ts`:

1. **Add `extractFlightNumber()` function** — regex to pull airline+number from various formats:
   - `DL0679`, `DL 679`, `DL679`, `(DL 679)` → `dl679`
   - Handles 2-letter IATA codes + 1-4 digit numbers

2. **Update `makeContentKey()`** — before falling through to title-based matching, check if the normalized title contains a flight number. If so, use `flight:dl679|2026-04-13` as the key (ignoring start_time, which flights already do).

3. **Update `isFlightTitle()`** — also return true when a flight number pattern is detected (not just 2+ airport codes). This ensures flight dedup skips `start_time` in the key.

4. **Update `classifyActivity()`** — detect `DL0679`-style titles as flights (currently only matches the word "flight").

### Files to edit
- `supabase/functions/_shared/calendar-helpers.ts` — add flight number extraction, update `makeContentKey`, `isFlightTitle`, and `classifyActivity`

### What this fixes
- iCal `DL0679 | JFK to SFO` and gcal `Flight to SFO (DL 679)` will both produce content key `flight:dl679|2026-04-13` → deduplicated
- Manual entry `Flight to SFO (DL 679)` will also match via flight number → incoming syncs merge onto it instead of creating new records
- Non-flight events are completely unaffected

