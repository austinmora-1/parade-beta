

## Redesign Plans UI: Card-Based Weekly Swiper + Trips Page

### Summary
Replace the calendar-oriented Plans view with a horizontally-swipeable, card-based weekly layout. Move Trips to its own dedicated page with a new bottom nav tab, and remove the FAB button entirely.

### Changes

**1. New Plans/Availability page (`src/pages/Availability.tsx`)**
- Remove the Daily/Trips tab switcher entirely
- Remove TripsList import and rendering
- Remove "Add Trip" button from header
- Replace AvailabilityGrid with a new weekly card swiper component
- Keep: header with "Plans" title, sync button, "Add Plan" button, Share button, "View Plan List" link
- Add week navigation (left/right arrows + "This Week" button) showing the current week range (e.g. "Apr 7 – 13")
- Show plans for the selected week as horizontally-scrollable cards (one card per plan, grouped by day)
- Each day section shows the day label (e.g. "Mon, Apr 7") with plan cards stacked horizontally beneath
- Swipe left/right to navigate between weeks

**2. New component: `src/components/plans/WeeklyPlanSwiper.tsx`**
- Accepts plans array and week offset state
- Groups plans by day within the current week
- Renders each day as a row with plan cards in a horizontal scroll container
- Days with no plans show a subtle "No plans" indicator
- Plan cards reuse the existing `PlanCard` component (compact mode)
- Swipe gesture support to move between weeks
- Week navigation header with chevrons and "This Week" reset

**3. New Trips page (`src/pages/Trips.tsx`)**
- New standalone page at `/trips` route
- Contains the TripsList component, AddTripDialog, MissingReturnDialog, TripConflictDialog (moved from Availability)
- Header: "Trips" with "Add Trip" button
- Keeps all existing trip conflict and missing return logic

**4. Update bottom navigation (`src/components/layout/MobileNav.tsx`)**
- Remove the entire FAB button and its pop-up actions (QuickPlanSheet, SendVibeDialog, AddTripDialog)
- Remove the left/right item split — just render all nav items in a flat row
- Add new "Trips" tab with `PlaneTakeoff` icon, linking to `/trips`
- Nav order: Home, Plans, Trips, Friends, Inbox
- Update `isActive` to handle `/trips` route

**5. Update desktop sidebar (`src/components/layout/Sidebar.tsx`)**
- Add "Trips" nav item with PlaneTakeoff icon at `/trips`

**6. Update routing (`src/App.tsx`)**
- Add new route for `/trips` inside the protected AppLayout
- Lazy-load the Trips page

**7. Update `UpcomingPlans.tsx`**
- Update `TIME_SLOT_HOURS['early-morning']` from `{ start: 6, end: 9 }` to `{ start: 2, end: 9 }` to match the time slot logic change made earlier

### Technical details

- The `WeeklyPlanSwiper` uses `startOfWeek`/`endOfWeek` from date-fns with `weekStartsOn: 1` (Monday)
- Horizontal scroll uses CSS `overflow-x: auto` with `snap-x snap-mandatory` for card snapping
- Week swipe uses the same touch gesture pattern already in `Availability.tsx`
- The FAB removal simplifies the nav to 5 equal-width items with no special center element

