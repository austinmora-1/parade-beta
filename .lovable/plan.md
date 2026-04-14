

# Optimize Location Logic for Multi-Leg Trips

## Problem

The current flight logic uses a binary **outbound vs return** model: a flight is either "going away" (`isReturn = false`) or "coming home" (`isReturn = true`). This fails for multi-leg itineraries like:

```text
Apr 13: JFK → SFO  (outbound — marks as SF)
Apr 17: SFO → DFW  (NOT a return — but also not "home". Currently treated as outbound to Dallas, but the SF trip never ends properly)
Apr 24: DFW → JFK  (return home)
```

The system fills intermediate dates per-outbound-flight by looking ahead for a "return" or "different city" flight. But it doesn't properly **end** the previous city's run when a secondary leg starts. This causes SF to persist from Apr 13 all the way until it hits a flight date, rather than ending on Apr 16.

Additionally, this logic is duplicated across 3 sync paths (`google-calendar-sync`, `ical-sync`, `calendar-sync-worker`), and the DB trigger can't shrink trips.

## Plan

### 1. Create `resolveLocationsByDate()` in `calendar-helpers.ts`

A single shared function that replaces the ~80 lines of flight/hotel → location-by-date logic duplicated in all 3 sync paths. The key algorithmic change:

**New approach — segment-based, not binary:**
- Sort all flights chronologically
- Walk through flights in order, building **segments**: each outbound flight starts a new segment for its destination city
- When a new outbound flight to a *different* city appears, it **ends** the previous segment on the day before
- A return-home flight ends the current segment on that day
- Fill intermediate dates within each segment only
- No more binary outbound/return assumption — every non-home flight simply starts a new destination segment

Example with JFK→SFO (Apr 13), SFO→DFW (Apr 17), DFW→JFK (Apr 24):
```text
Segment 1: San Francisco, Apr 13–16 (ends day before DFW flight)
Segment 2: Dallas, Apr 17–23 (ends day before return)
Apr 24: return home
```

The function signature:
```typescript
export function resolveLocationsByDate(params: {
  allFlights: FlightInfo[];
  hotelStays: HotelStay[];
  homeAddress: string | null;
  existingTrips: ExistingTrip[];
}): {
  locationByDate: Map<string, string>;
  returnHomeDates: Set<string>;
  outboundFlightDates: Set<string>;
  pendingReturnTrips: PendingReturnTrip[];
}
```

### 2. Refactor all 3 sync paths to use the shared function

Replace the duplicated flight-fill logic in:
- `supabase/functions/google-calendar-sync/index.ts` (lines ~98–200)
- `supabase/functions/ical-sync/index.ts` (equivalent block)
- `supabase/functions/calendar-sync-worker/index.ts` (equivalent block)

Each will call `resolveLocationsByDate()` after collecting flights and hotels, then proceed with availability upserts using the returned `locationByDate` map.

### 3. Update the DB trigger to support trip shrinking

Modify `auto_create_trip_from_availability()`:
- When a day changes to a different city, find the trip for the old city covering that date
- Scan availability to find the actual remaining consecutive run of days for the old city
- If the run is shorter than the current trip range, **UPDATE** `start_date`/`end_date`
- If no consecutive days remain, **DELETE** the trip
- Use `normalize_trip_city()` consistently instead of `lower(trim())` for all comparisons

### 4. Fix stale SF trip data

Use the insert tool to update the existing SF trip (id: `c6dcf951`) to end on April 16 instead of April 24.

### 5. Unify city normalization

Add a `normalizeCityForComparison()` function in `calendar-helpers.ts` that matches the output of the DB's `normalize_trip_city()` function — lowercase, airport-code-resolved, abbreviation-resolved. Use it in the new `resolveLocationsByDate()` to ensure edge functions and DB trigger agree on city identity.

## Summary of File Changes

| File | Change |
|------|--------|
| `calendar-helpers.ts` | Add `resolveLocationsByDate()`, `normalizeCityForComparison()` |
| `google-calendar-sync/index.ts` | Replace ~100 lines of flight-fill with shared function call |
| `ical-sync/index.ts` | Same replacement |
| `calendar-sync-worker/index.ts` | Same replacement |
| DB migration | Update trigger with shrink logic + normalize_trip_city consistency |
| DB data fix | Update stale SF trip end_date |

