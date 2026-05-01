## Goal

Tighten availability so any plan (confirmed / tentative / proposed) blocks the slots it actually covers, and surface partial-overlap slots as a distinct "partially available" state that shows the free sub-window and is deprioritized in Recommended.

## Slot model recap

Six fixed slots: early-morning (6–9), late-morning (9–12), early-afternoon (12–15), late-afternoon (15–18), evening (18–22), late-night (22–26).

Today a plan stores a single `time_slot` and only blocks that one column in `availability`, so a 5–8pm plan blocks `late-afternoon` only — `evening` looks free even though 6–8pm is taken. We want to model this correctly without losing the truly-free 3–5pm sub-window of `late-afternoon`.

## New concept: per-slot coverage

For any plan with `start_time`/`end_time`, compute:

- **fully covered slots**: the plan covers the entire slot window → slot is `busy`
- **partially covered slots**: the plan overlaps part of the slot window → slot is `partial`, and we know the free `[startHr, endHr]` sub-window(s)

Plans without explicit times keep today's behavior: their single `time_slot` is fully covered.

New helper `src/lib/planSlotCoverage.ts`:

```text
getPlanSlotCoverage(plan)  -> Array<{ slot, kind: 'full'|'partial', freeRanges: [startHr,endHr][] }>
mergeCoverage(coverages)   -> Map<slot, { kind, freeRanges }>   // combines multiple plans on a day
```

`freeRanges` is computed by subtracting the plan's hour interval from the slot's hour bounds. For a partial slot we keep the remaining free interval(s); fully covered → empty.

## 1. Persist accurate availability when plans change

`src/stores/plansStore.ts` — in `addPlan`, `proposePlan`, `updatePlan`, and the delete/decline paths:

- Compute coverage with `getPlanSlotCoverage` for the new and (on update/delete) old plan.
- For each fully covered slot in `{confirmed, tentative, proposed}`, upsert `availability.<slot> = false`.
- For partial slots we still write `false` for the slot column (the boolean can't represent "partial"), but we tag the slot as `partial` in-memory via the store (see step 3) so UI can render it differently. The `false` keeps any caller that only reads the boolean safe (it won't be recommended), while the in-memory partial flag lets us show the free sub-window.
- On delete / status → cancelled: recompute remaining coverage from other plans on that date+slot. If nothing remains, restore the slot to the user's default availability for that weekday (read from `availabilityStore.defaultSettings`).

## 2. Backfill historical drift

One-time SQL migration that, for every plan with `status in ('confirmed','tentative','proposed')`, walks `start_time`→`end_time` (falling back to `time_slot`) and upserts `availability.<covered_slot> = false`. This fixes already-stored proposed/tentative plans (e.g. the 5/8 dinner) whose availability rows still say `true`.

## 3. Expose "partial" status to the UI

Extend `DayAvailability` (in `src/types/planner.ts` / `availabilityStore`) with an optional per-slot overlay:

```text
slotCoverage?: Partial<Record<TimeSlot, {
  kind: 'busy' | 'partial';
  freeRanges: Array<[number, number]>;  // empty for busy
}>>
```

Computed (not persisted) in `plannerStore` whenever plans/availability load, by running `mergeCoverage` over that day's plans. `slots[slot]` boolean stays as today (false for busy or partial); `slotCoverage` adds the nuance.

## 4. Recommended hook deprioritizes partial slots

`src/hooks/useOpenWindows.ts`:

- When building the user's `slotMap`, treat partial slots as candidates again — but only for their `freeRanges`. Generate window candidates using those sub-ranges (e.g. late-afternoon partial with free 15–17 → a 2-hour 3pm–5pm candidate).
- In `preferenceScore`, apply a multiplier (e.g. ×0.5) when the candidate's slot is `partial`, so equally-fitting fully-free slots win.
- Apply the same coverage expansion to `friendPlans` so friend overlap also respects multi-slot plans.

## 5. UI: show partial state with an "adjacent plan" indicator

Slot pills in `WeekOverview.tsx`, `WeekendAvailability.tsx`, `FriendVibeStrip.tsx`, and `FreeWindowCard.tsx`:

- Add a `partial` visual state: striped/half-tone background using existing `availability-available` + `primary` tokens; reuse a new utility class `bg-availability-partial` (define via CSS gradient in `index.css`, no new color tokens).
- Render the free sub-window text next to the slot label, e.g. "Late afternoon · 3–5pm free".
- Add a small `Clock` icon with a muted "Near another plan" tooltip / aria-label when `kind === 'partial'`.
- In `WeekOverview` / `WeekendAvailability` summary bars, render partial slots as a half-filled bar segment (split the `flex-1` div into two halves colored available + busy).

## 6. Slot pickers in plan/trip flows

`QuickPlanSheet.tsx`, `GuidedPlanSheet.tsx`, `GuidedTripSheet.tsx`, `FriendVibeStrip.tsx` slot grids:

- Keep partial slots selectable but visually demoted (dashed border, "near another plan" hint).
- Filter overlap queries (already widened to `confirmed/tentative/proposed`) through `getPlanSlotCoverage` so the conflict check matches what's persisted.

## Out of scope

- Wrong "Today" date label on the upcoming May 8 plan in the screenshot — that's a date-formatting bug in `UpcomingPlans`, separate from availability.
- Changing the `availability` schema to store partial state on the server — handled purely client-side from plan rows for now.

## Files to touch

- new `src/lib/planSlotCoverage.ts`
- `src/stores/plansStore.ts`
- `src/stores/plannerStore.ts` and/or `src/stores/availabilityStore.ts` (slotCoverage overlay)
- `src/types/planner.ts` (DayAvailability type)
- `src/hooks/useOpenWindows.ts`
- `src/components/dashboard/WeekOverview.tsx`
- `src/components/dashboard/WeekendAvailability.tsx`
- `src/components/dashboard/FreeWindowCard.tsx`
- `src/components/dashboard/FriendVibeStrip.tsx`
- `src/components/plans/QuickPlanSheet.tsx`
- `src/components/plans/GuidedPlanSheet.tsx`
- `src/components/trips/GuidedTripSheet.tsx`
- `src/index.css` (new `bg-availability-partial` utility)
- new SQL migration: backfill `availability` from existing `confirmed/tentative/proposed` plans
- update memory: `mem://features/availability-plan-synchronization` to reflect partial coverage
