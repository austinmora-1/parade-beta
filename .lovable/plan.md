

# plannerStore Split Refactor

## Overview
Extract duplicated mapping/transformation logic into reusable helpers, reducing `plannerStore.ts` from ~1,744 lines to ~700 lines. The Zustand store shape and public API stay identical — no consumer changes needed.

## Architecture

The store contains three categories of duplicated heavy logic:

1. **Plan mapping** (~120 lines duplicated between `loadAllData` and `loadPlans`) — raw DB row → `Plan` object with timezone conversion, participant resolution, dedup
2. **Friend mapping** (~80 lines duplicated) — outgoing/incoming friendship merge, status-priority dedup
3. **Availability mapping** (~60 lines duplicated between `loadAllData` and `loadProfileAndAvailability`/`loadAvailabilityForRange`) — DB row → `DayAvailability` with slot locations, defaults

## File Plan

```text
src/stores/
  plannerStore.ts          (1744→~700 lines) — state, setters, Supabase calls
  helpers/
    mapPlans.ts            (~130 lines) — mapRawPlanToModel(), buildParticipantsMap()
    mapFriends.ts          (~80 lines)  — mapFriendships(), dedupeFriends()
    mapAvailability.ts     (~90 lines)  — mapAvailabilityRow(), createDefaultAvailability(), buildAvailabilityMap()
    types.ts               (~40 lines)  — DashboardData, DefaultAvailabilitySettings interfaces
```

## Steps

1. **Create `src/stores/helpers/types.ts`** — Move `DashboardData` and `DefaultAvailabilitySettings` interfaces out of the store.

2. **Create `src/stores/helpers/mapAvailability.ts`** — Extract `createDefaultAvailability`, `buildAvailabilityMap`, `TIME_SLOT_HOURS`, and the shared availability-row-to-`DayAvailability` mapper used in three places.

3. **Create `src/stores/helpers/mapPlans.ts`** — Extract the plan-row-to-`Plan` conversion (timezone handling, participant assembly, owner injection). Both `loadAllData` and `loadPlans` will call the same function.

4. **Create `src/stores/helpers/mapFriends.ts`** — Extract outgoing/incoming friendship mapping and the two-pass dedup logic used identically in `loadAllData` and `loadFriends`.

5. **Update `plannerStore.ts`** — Replace inline logic with imports from the helpers. No changes to the exported `usePlannerStore` API or state shape.

## Risk Mitigation
- Pure extraction refactor — no logic changes, no API changes
- Every consumer file (`usePlannerStore(s => s.plans)`, etc.) continues working unchanged
- Helpers are pure functions with no side effects — easy to unit test later

