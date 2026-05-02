## Goal

Combine the **Plans** and **Trips** tabs into a single unified view at `/availability`, so users see hangouts and trips overlapping in one weekly timeline without clutter. Replace the current `All / Parade / Calendar` filter with `All / Plans / Trips`.

## UX Overview

- The **Plans** tab becomes the home for both hangouts and trips.
- Default view (`All`) shows a chronological week with hangout cards inline on their day, and a **slim multi-day trip banner** spanning the days a trip covers (rendered above that week's day rows, not as a per-slot card — this is the key anti-clutter move).
- `Plans` filter hides trip banners; `Trips` filter hides hangout cards and shows trip banners + an expanded trip list below the week.
- The bottom nav **Trips** item is removed (4 items total: Home, Plans, Friends, Profile). Existing routes (`/trips`, `/trip/:id`) continue to work but `/trips` redirects to `/availability?view=trips`.

## Visual Layout (week with overlap)

```text
┌─ Mon Mar 3 ─────── Sun Mar 9 ────────────────┐
│ ▓▓▓ Trip · Tokyo · Mar 5 – Mar 12 →           │  ← slim trip banner (spans days)
│                                                │
│ Mon · 0 plans                                  │
│ Tue · 0 plans                                  │
│ Wed ┃ 7pm  Dinner w/ Alex                      │  ← hangout card (day inside trip)
│ Thu ┃ 6pm  Run                                 │
│ Fri · 0 plans                                  │
│ Sat ┃ 11am Brunch                              │
│ Sun · 0 plans                                  │
└────────────────────────────────────────────────┘
```

- Trip banner: 1 line, low-contrast tinted strip (reuses parade-green at low alpha), with plane icon + name + date range. Tapping opens `/trip/:id`.
- If a trip spans multiple weeks, a small `→` / `←` chevron indicates continuation; banner re-appears on each affected week.
- Multiple overlapping trips stack vertically (rare, but supported — capped at 2 visible with "+N more").

## Filter Behavior

Replace the existing `ToggleGroup` in `src/pages/Availability.tsx`:

| Filter | Hangout cards | Trip banners | Trip proposals |
|---|---|---|---|
| All (default) | ✓ | ✓ | ✓ (compact) |
| Plans | ✓ | hidden | hidden |
| Trips | hidden | ✓ | ✓ (expanded list under week) |

The old `parade` vs `calendar` source filter is removed entirely (low usage, and the calendar-vs-parade distinction is already shown via card styling). The filter state is URL-synced via `?view=all|plans|trips` so `/trips` redirect lands on the right tab.

## Implementation Plan

### 1. Routing & nav
- `src/components/layout/MobileNav.tsx`: remove the `Trips` nav item; keep 4 items (Home, Plans, Friends) + Profile avatar.
- `src/components/layout/Sidebar.tsx`: same removal (desktop nav).
- `src/App.tsx`: keep `/trips` route but redirect to `/availability?view=trips`. Keep `/trip/:id` untouched.

### 2. Availability page (`src/pages/Availability.tsx`)
- Replace `sourceFilter` state (`all | parade | calendar`) with `viewFilter` (`all | plans | trips`), URL-synced via `useSearchParams`.
- Update header: `<h1>Plans & Trips</h1>` (still keep `font-display`).
- Replace `Add Plan` single button with a small split: `Add Plan` and `Add Trip` (the latter opens the existing `GuidedTripSheet` lazily). Keep Share button as-is.
- Always render the toggle group (no longer gated on `hasAnyCalendar`).
- Drop the `isCalendarSourced` import and related filtering.

### 3. Fetch trips alongside plans
- New hook `src/hooks/useUserTrips.ts`: returns `{ trips, loading, refresh }`. Fetches `trips` table for the current user where `end_date >= today` (mirrors `TripsList.fetchTrips`). Subscribes to the existing `trips:updated` window event for refresh.
- Availability page calls `useUserTrips()` and passes `trips` into `WeeklyPlanSwiper`.

### 4. Weekly swiper trip banners (`src/components/plans/WeeklyPlanSwiper.tsx`)
- Add prop: `trips?: Trip[]` and `viewFilter: 'all' | 'plans' | 'trips'`.
- New `tripsForWeek` memo: filter trips that overlap `[weekStart, weekStart+6]`.
- Render a `<TripWeekBanner>` (new component in `src/components/plans/weekly-plan/TripWeekBanner.tsx`) above `PastDaysCollapsible` when `viewFilter !== 'plans'`.
- When `viewFilter === 'trips'`, pass an empty plans array down so day rows render only date headers (still useful as scaffolding) plus the banners.

### 5. Trips filter detail panel
- When `viewFilter === 'trips'`, render `<TripsList />` (the existing component) below the weekly swiper for the full management UI (proposals, RSVP, etc.). This avoids rebuilding trip management — we just embed it.

### 6. Trips page
- `src/pages/Trips.tsx`: replace its body with `<Navigate to="/availability?view=trips" replace />` so deep links and old bookmarks still work. Delete nothing else (the page file remains as the redirect host).

### 7. Memory update
- Update `mem://features/dashboard-week-overview` (or add a new `mem://features/plans-trips-merged-view`) noting:
  - Plans tab now hosts both hangouts and trips.
  - Source filter (parade/calendar) removed; replaced with All/Plans/Trips.
  - Bottom nav has 4 items + profile; Trips standalone tab removed.
  - `/trips` redirects to `/availability?view=trips`.

## Files Touched

Edited:
- `src/pages/Availability.tsx` — filter swap, trip fetching, banner integration
- `src/pages/Trips.tsx` — redirect-only
- `src/components/plans/WeeklyPlanSwiper.tsx` — trip banner rendering, viewFilter prop
- `src/components/layout/MobileNav.tsx` — remove Trips item
- `src/components/layout/Sidebar.tsx` — remove Trips item
- `src/App.tsx` — `/trips` redirect
- `mem://index.md` + new memory file

Created:
- `src/hooks/useUserTrips.ts`
- `src/components/plans/weekly-plan/TripWeekBanner.tsx`

## Out of Scope

- No data model changes; trips and plans remain separate tables.
- No changes to `/trip/:id` detail pages or trip creation flow.
- The dashboard `UpcomingTripsAndVisits` widget is untouched.
- Calendar-sourced plans still render as before — just no longer filterable separately on this page.

## Open Question

Should the **Add Trip** button live on the Plans page header (alongside Add Plan), or only show when `viewFilter === 'trips'` to keep the default header lean? Default plan: always show both, since the merged tab is meant to be a one-stop shop.
