

# Improve Departure City Fallback from Previous Slot/Day Location

## Problem
When a flight reservation doesn't include a departure city, the `resolveSlotLocations` function walks back through `locationByDate` to find the previous location. However, `locationByDate` only contains **away** locations (from outbound flights/hotels). If the user is at their travel destination (e.g., Dallas) and `locationByDate` happens to not have that date populated (e.g., edge cases with segment boundaries), or the home address doesn't match, the departure city resolves incorrectly or not at all.

## Fix

### 1. Backend: Improve fallback in `resolveSlotLocations` (calendar-helpers.ts)

Enhance the fallback logic when `departureCity` is null to also check:
1. The **previous day's slot locations** (the last non-null slot from the day before — e.g., `slot_location_late_night` or `slot_location_evening`)
2. The existing `locationByDate` walkback (already implemented)
3. Home address as final fallback

This means checking the already-resolved `result` map (previous flight days' slot locations) in addition to `locationByDate`. The key change is on the walkback at lines 1196-1209: after checking `locationByDate`, also check if the previous date had slot-level locations in the `result` map already built, and use the last populated slot from that day.

### 2. Client-side: Fallback in `getLocationLabel` (WeeklyPlanSwiper.tsx)

When building the split-location label, if the first slot location is null/empty but the previous day has a known `tripLocation` or slot location, use that as the departure city for the arrow indicator. This ensures even if the DB data is stale, the UI can infer the departure from the previous day's availability record.

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/_shared/calendar-helpers.ts` | In `resolveSlotLocations`, extend fallback to check previously resolved slot locations from the `result` map for the prior date |
| `src/components/plans/WeeklyPlanSwiper.tsx` | In `getLocationLabel`, when first unique city is missing, look up previous day's `tripLocation` or last slot location from `availabilityMap` |

