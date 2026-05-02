## Goal

Make the trip a single, atomically editable entity. Editing a trip's date/location/participants must update one logical record — never spawn a duplicate `trips` row, never leave the linked `trip_proposal_dates` out of sync.

## Root causes being fixed

1. `availability` rows are not linked to `trips.id`. The `auto_create_trip_from_availability` trigger guesses ownership by fuzzy-matching `trip_location` city strings, so any date shift can spawn an empty duplicate trip.
2. When a trip originated from a finalized `trip_proposal`, edits to `trips` don't propagate to `trip_proposal_dates`. The proposal's "winning date" drifts.
3. The edit flow in `AddTripDialog.handleSave` writes availability **before** updating the trip, so the trigger sees stale dates and decides to insert.

## Approach

Make `availability` carry a real foreign key to `trips.id`, rewrite the trigger to resolve the trip by id (not by string), and update the edit handler to do everything in the right order plus sync the proposal.

### 1. Schema migration

- Add `availability.trip_id uuid NULL REFERENCES public.trips(id) ON DELETE SET NULL`.
- Add index `idx_availability_trip_id`.
- Backfill: for each `availability` row where `location_status='away'` and `trip_location` is set, find the user's trip whose `[start_date, end_date]` covers `availability.date` and whose `normalize_trip_city(location)` matches `normalize_trip_city(trip_location)`. Set `trip_id` to that match (skip if ambiguous).

### 2. Trigger rewrite (`auto_create_trip_from_availability`)

Replace the existing function with id-aware logic:

- **If `NEW.trip_id IS NOT NULL`** (the client knows which trip this row belongs to):
  - Skip create/extend/delete entirely. The client owns the trip lifecycle. Just return `NEW`.
- **Else, legacy/calendar-sync path** (no `trip_id` provided, e.g. iCal-derived availability):
  - Keep current "extend or create" behavior, but tighten the pre-insert dedupe so it skips when **any** trip exists for `(user_id, normalized location)` that overlaps the consecutive run by ±1 day. This eliminates the race when a user is mid-edit.
- **Cleanup path** (`location_status='home'` or `trip_location IS NULL`):
  - If the cleared row had a `trip_id` (use `OLD.trip_id`), shrink/delete only that trip; do not iterate by location string.
  - Otherwise fall back to current location-based shrink/delete logic for legacy rows.

### 3. `AddTripDialog.handleSave` rewrite (edit path)

When `editingTrip?.id` is set, do this in order inside one logical operation:

1. **Update the trip row first** (`trips`) with new `start_date`, `end_date`, `location`, `available_slots`, `priority_friend_ids`. This way the trigger sees the new range immediately — but with the next change it won't matter anyway because we'll pass `trip_id` on every availability row.
2. **Reset old availability days** that fall outside the new range — set `location_status='home'`, `trip_location=null`, **`trip_id=null`**.
3. **Upsert new availability days** for the new range with `location_status='away'`, `trip_location=<city>`, **`trip_id=editingTrip.id`**, plus the per-slot booleans.
4. **Sync `trip_participants`**: delete + reinsert (current behavior).
5. **If `editingTrip.proposalId`** is set: locate the `trip_proposal_dates` row that previously matched the old trip dates for that proposal (`proposal_id=… AND start_date=oldStart AND end_date=oldEnd`) and update it to the new start/end. If no row matches (should be rare), skip silently. Do not touch `trip_proposal_participants`.
6. **Local dedupe sweep**: delete any other `trips` row owned by the same `user_id` with the same `start_date`, `end_date`, normalized `location`, **no `proposal_id`**, **no `trip_participants`**, and `id != editingTrip.id`. Targets only orphan rows the old trigger may have created in the past for this user; safe and scoped.

For the create path (no `editingTrip`), pass `trip_id` on the availability upserts after the trip row is inserted (insert trip first, then insert availability with the new id). This eliminates the duplicate-trip risk for new trips too.

### 4. Type / prop updates

- `TripData` (in `AddTripDialog`) gains optional `proposalId?: string`.
- `TripDetail.tsx` populates `editTripData.proposalId = trip.proposal_id ?? undefined`.
- No UI changes anywhere.

### 5. Backfill data integrity (one-off, in migration)

After the trigger rewrite, run a one-time cleanup:

```text
DELETE FROM trips t
WHERE proposal_id IS NULL
  AND priority_friend_ids = '{}'
  AND NOT EXISTS (SELECT 1 FROM trip_participants tp WHERE tp.trip_id = t.id)
  AND EXISTS (
    SELECT 1 FROM trips t2
    WHERE t2.user_id = t.user_id
      AND t2.id <> t.id
      AND normalize_trip_city(t2.location) = normalize_trip_city(t.location)
      AND t2.start_date <= t.end_date
      AND t2.end_date   >= t.start_date
  );
```

This removes the existing "ghost" duplicate trips like the second "New York" card from the screenshot. It only deletes rows with no companions, no proposal link, and another overlapping trip for the same user+city.

## Files touched

- `supabase/migrations/<new>.sql` — add `availability.trip_id` + index, backfill, replace `auto_create_trip_from_availability`, ghost-trip cleanup.
- `src/components/profile/AddTripDialog.tsx` — reorder edit flow, write `trip_id` on availability upserts, sync `trip_proposal_dates`, local dedupe.
- `src/pages/TripDetail.tsx` — pass `proposalId` on `editTripData`.

No visual / UI changes. No changes to `trips` schema. No changes to RLS (the new FK column is covered by existing `availability` policies).

## Out of scope

- Splitting/merging trips manually.
- Reworking `trip_proposals` so a single proposal yields a single shared trip row (currently each participant gets their own `trips` row). That's a larger refactor; today we just keep them in sync on edit.
- Changing `availability` schema beyond adding `trip_id`.

## Risk notes

- The trigger rewrite changes behavior for non-app writers (e.g. calendar sync that writes availability without setting `trip_id`). They keep the legacy path with the tightened dedupe, so behavior should be equivalent or stricter, never looser.
- Backfill matches by overlap + normalized city. Edge case: if a user has two overlapping trips to the same city, backfill will skip those rows (leaves `trip_id` null). That's correct — those rows continue to use the legacy path.
