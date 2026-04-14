

# Split-Location Days for Flight Travel

## Problem
Currently, when a user has a flight on a given day (e.g., April 25: Austin → New York, departs 9:49am, lands 1:28pm), the entire day is assigned a single location. The user should instead show as:
- **Dallas** for early morning (before departure)
- **Unavailable** during the flight window (9:49am–1:28pm)
- **New York** from 1:28pm onward

## Current Architecture Constraints
- The `availability` table has one `location_status` and `trip_location` per day — no per-slot granularity
- `FlightInfo` stores only `date`, `timestamp`, `city`, and `isReturn` — no departure city or arrival time
- The UI (`DaySummaryDropdown`, `CalendarView`, `WeeklyPlanSwiper`) reads a single location per day

## Technical Design

### 1. Database: Add per-slot location columns to `availability`

Add 6 new nullable text columns to the `availability` table — one per time slot — to store the location for that specific slot:

```
slot_location_early_morning    text  (nullable)
slot_location_late_morning     text  (nullable)
slot_location_early_afternoon  text  (nullable)
slot_location_late_afternoon   text  (nullable)
slot_location_evening          text  (nullable)
slot_location_late_night       text  (nullable)
```

When all are null, the existing `trip_location` applies to the whole day (backward compatible). When populated, they override `trip_location` for that slot.

### 2. Enrich `FlightInfo` with departure/arrival details

Extend the `FlightInfo` interface in `calendar-helpers.ts`:

```typescript
export interface FlightInfo {
  date: string
  timestamp: number       // departure time
  arrivalTimestamp: number // NEW: arrival/landing time
  city: string | null      // destination city
  departureCity: string | null // NEW: origin city
  isReturn: boolean
}
```

Update flight collection in all 3 sync paths (`google-calendar-sync`, `ical-sync`, `calendar-sync-worker`) to capture:
- The **first** airport code as departure city (currently only the last/destination is captured)
- The event **end time** as `arrivalTimestamp`

### 3. New `resolveLocationsBySlot()` function in `calendar-helpers.ts`

A new function that builds per-slot location assignments for flight days:

```typescript
export function resolveSlotLocations(params: {
  allFlights: FlightInfo[]
  locationByDate: Map<string, string>  // from existing resolveLocationsByDate
  homeAddress: string | null
  timezone?: string
}): Map<string, Record<string, string | null>>
// Returns: date → { slot_location_early_morning: "Dallas", ... }
```

Logic for a flight day:
- Slots **before** departure time → previous city (from preceding day's location or departure city)
- Slots **during** the flight (departure to arrival) → mark slot as unavailable (set `false` in busy slots)
- Slots **at or after** arrival time → destination city

### 4. Update `upsertAvailabilityWithLocation()` in `calendar-helpers.ts`

Extend the upsert logic to write the per-slot location columns when they exist. The existing `location_status` and `trip_location` remain as the "primary" location for the day (set to the destination city, as the user ends the day there).

### 5. Update the DB trigger `auto_create_trip_from_availability`

Modify the trigger to read per-slot locations when determining trip boundaries. A day with mixed locations should not break a trip — it belongs to whichever trip the user is transitioning between.

### 6. Frontend: Update store and UI components

**`plannerStore.ts`**: 
- Add slot location fields to the availability data model
- Add `getSlotLocationForDate(date, slot)` helper

**`DaySummaryDropdown.tsx`**:
- Show per-slot location badges when slot locations differ from the day's primary location
- Display "In transit" or flight icon for slots during a flight

**`CalendarView.tsx` / `WeeklyPlanSwiper`**:
- Show split-location indicator (e.g., two city names) when a day has mixed locations

**`types/planner.ts`**:
- Extend `DayAvailability` type with optional slot location fields

## File Changes Summary

| File | Change |
|------|--------|
| DB migration | Add 6 `slot_location_*` columns to `availability` |
| `calendar-helpers.ts` | Extend `FlightInfo`, add `resolveSlotLocations()`, update upsert |
| `google-calendar-sync/index.ts` | Capture departure city + arrival time in FlightInfo |
| `ical-sync/index.ts` | Same |
| `calendar-sync-worker/index.ts` | Same |
| `types/planner.ts` | Extend `DayAvailability` with slot locations |
| `plannerStore.ts` | Add slot location accessors, update dashboard data parsing |
| `DaySummaryDropdown.tsx` | Show per-slot location labels |
| `CalendarView.tsx` | Split-location day indicator |
| `integrations/supabase/types.ts` | Auto-updated after migration |
| DB trigger migration | Update `auto_create_trip_from_availability` for slot-aware logic |

## Scope & Risk
This is a significant cross-cutting change touching the database schema, 3 edge functions, the shared helper library, the state store, and multiple UI components. The backward-compatible approach (slot columns are nullable, falling back to `trip_location`) minimizes risk for existing data.

