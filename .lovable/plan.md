

## Plan: Fix timezone display on plan cards

### Problem Summary

Two issues with timezone display:

1. **Many plans have no timezone at all** — The calendar sync backend only reads `profiles.timezone` (explicit setting). ~47% of Google Calendar plans have `source_timezone = NULL` because users haven't explicitly set a timezone. The sync should fall back to resolving timezone from the user's location status (home address or trip location), matching the frontend's `getUserTimezone()` logic.

2. **Wrong timezone abbreviation shown** — The UI displays the plan's *source* timezone abbreviation (e.g., "EDT" for a plan created in New York), but the displayed times have already been *converted* to the viewer's current timezone (e.g., PDT because they're in San Francisco). The abbreviation should reflect the viewer's timezone so it matches the displayed time.

### Changes

#### 1. Backend: Fix calendar sync to always resolve timezone (`supabase/functions/calendar-sync-worker/index.ts`)

In `syncGoogleCalendar()` (line ~135-141), after fetching the profile, resolve the timezone using the same logic as the frontend:
- Fetch today's availability row for the user (to get `location_status` and `trip_location`)
- Implement a server-side version of `getUserTimezone()`: if explicit timezone is set use it, otherwise if "away" use trip location's timezone, otherwise use home address timezone, otherwise fallback to `'America/New_York'`
- This ensures `source_timezone` is always populated for new syncs

Also apply the same fix to the iCal sync function (`supabase/functions/ical-sync/index.ts`).

#### 2. Backend: Backfill existing NULL source_timezone plans (database migration)

Run a migration that sets `source_timezone` for existing plans where it's NULL, using the plan owner's profile timezone/home_address as a best-effort resolution.

#### 3. Frontend: Show viewer's timezone, not source timezone (`src/components/plans/WeeklyPlanSwiper.tsx`, `src/components/dashboard/UpcomingPlans.tsx`)

Currently the plan card shows `getTimezoneAbbreviation(plan.sourceTimezone)`. After timezone conversion, times are in the viewer's timezone. Change these to show the viewer's resolved timezone abbreviation instead:
- In `WeeklyPlanSwiper.tsx`: Access `viewerTimezone` from the planner store and display `getTimezoneAbbreviation(viewerTimezone)` on every plan card (not just ones with `sourceTimezone`)
- In `UpcomingPlans.tsx`: Same change — show the viewer's timezone abbreviation
- In `PlanDetail.tsx`: Show the viewer's timezone for the displayed times, while keeping the source timezone info available for editing

#### 4. Frontend: Always show timezone on plan cards

Currently the timezone abbreviation only renders when `plan.sourceTimezone` exists. Since we're now showing the viewer's timezone, it should always render — this fixes issue #1 from the UI perspective regardless of backend backfill.

### Technical Details

**Viewer timezone resolution** — already computed in `plannerStore.ts` at line ~317 via `getUserTimezone()`. Need to expose it from the store so card components can access it.

**Store change** — Add `viewerTimezone` to the planner store state so it's accessible to UI components without re-computing.

**Backend timezone resolution** — Replicate the city→timezone mapping logic server-side. The simplest approach: use a condensed version of the city map from `src/lib/timezone.ts` in the edge function, or resolve based on `profiles.timezone ?? profiles.home_address` with a simple fallback.

**Files to modify:**
- `supabase/functions/calendar-sync-worker/index.ts` — resolve timezone from availability/profile
- `supabase/functions/ical-sync/index.ts` — same fix
- `src/stores/plannerStore.ts` — expose `viewerTimezone` in store state
- `src/components/plans/WeeklyPlanSwiper.tsx` — show viewer tz abbreviation
- `src/components/dashboard/UpcomingPlans.tsx` — show viewer tz abbreviation
- `src/pages/PlanDetail.tsx` — show viewer tz for displayed times
- Database migration to backfill NULL `source_timezone` values

