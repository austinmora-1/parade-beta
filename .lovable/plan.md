

# Refine Find People & Find in Place flows

Extend the two flows so users can anchor an open invite to **something they've already created** rather than always describing a new plan/trip from scratch.

---

## Flow 02 · Find people — add "existing plan" entry

`FindPeopleSheet` (the new sheet from the prior plan) gains a **Step 0: anchor**:

```text
What are you trying to fill?
( ) An existing plan          ← shows list of upcoming own plans w/o full RSVPs
( ) Something new             ← original "describe the plan" path
```

**Existing plan branch**
- List source: `plannerStore.plans` filtered to `user_id === me`, future-dated, status ≠ cancelled.
- Each row: title, date, time slot, current participant avatars + count.
- Selecting one **prefills** title/activity/date/time_slot/location/notes from the plan and skips Step 1 (Describe). User goes straight to **audience → preview**.
- On send, the open-invite is created with `plan_id` linking it to the existing plan; when someone claims, they're added as a `plan_participants` row on that plan instead of spawning a new plan.

**New branch**: unchanged — the original describe → audience → preview path.

### Backend extension
- Add nullable `plan_id uuid references plans(id) on delete cascade` to `open_invites` (migration).
- Update `on-open-invite` edge function: if `plan_id` is set, insert into `plan_participants` for that plan instead of creating a new plan. Keep all existing notification logic.
- RLS: existing open-invite policies already scope by `user_id`; add a check that `plan_id`'s owner = invite creator.

---

## Flow 03 · Find in place — add "existing trip" entry

`GuidedTripSheet` already has trip vs visit branching. Add a **third entry mode** when launched from the FAB:

```text
Find in place
[ Plan a new trip ]   [ Plan a new visit ]   [ Use an existing trip ▾ ]
```

**Existing trip branch**
- Pulled from `trips` table where `user_id = me` and `end_date >= today` (re-use existing `useTrips`-style query in `TripsList`).
- Selecting a trip pre-fills destination + date range and **opens `FindPeopleSheet` directly**, with:
  - location prefilled to `trip.location`
  - date defaulting to `trip.start_date` (user can change to any day in the trip range — add a small date picker scoped to `[start_date, end_date]`)
  - audience step preselected to "Friends in {city} during this trip" (re-use the location-aware availability filter; falls back to all friends if none match).
- The resulting open-invite carries `trip_id` so it appears on the trip detail page as "Looking for company".

### Backend extension
- Add nullable `trip_id uuid references trips(id) on delete cascade` to `open_invites` (same migration).
- `on-open-invite`: when `trip_id` is set and someone RSVPs, create a plan attached to that trip and copy the responder into `trip_participants` if not already there.
- Surface invites with `trip_id` on `TripDetail` page in a new compact section.

---

## Files touched

**Edited**
- `src/components/dashboard/GreetingHeader.tsx` — pass `mode: 'find-people'` / `mode: 'find-in-place'` so the sheets know to show the anchor step.
- `src/components/plans/FindPeopleSheet.tsx` *(new from prior plan)* — add Step 0 anchor selector + existing-plan list + prefill logic.
- `src/components/trips/GuidedTripSheet.tsx` — add "Use an existing trip" entry that pivots into `FindPeopleSheet` with prefilled trip context.
- `src/pages/TripDetail.tsx` — render a "Open invites for this trip" strip when `trip_id`-linked invites exist.
- `supabase/functions/on-open-invite/index.ts` — branch on `plan_id` / `trip_id` presence.

**New**
- DB migration: `ALTER TABLE open_invites ADD COLUMN plan_id uuid …, ADD COLUMN trip_id uuid …;` + supporting indexes + RLS tweak.
- `src/components/plans/findpeople/AnchorStep.tsx` — small subcomponent listing existing plans / "something new".
- `src/components/trips/findinplace/ExistingTripPicker.tsx` — list of upcoming trips.

## Out of scope
- Editing the underlying plan/trip from inside these flows (still happens on the detail page).
- Cross-user trip anchoring (only your own trips for now).

