

## Enhance Trip Planning Functionality

Currently, adding a trip simply marks date ranges as "away" with an optional destination. This plan upgrades trips to support availability slots during the trip and priority friends to hang out with at the destination.

### What Changes

**1. Expand the AddTripDialog UI** (`src/components/profile/AddTripDialog.tsx`)
- Add a new section: **"Available time slots"** — a simplified time slot picker (reusing the existing 6-slot grid) letting users mark which slots they're free during the trip (default: all free, matching current behavior)
- Add a new section: **"Friends to see"** — a searchable friend picker (similar to the plan creation friend selector) letting users tag friends they want to prioritize hanging out with during the trip. Show connected friends filtered by those who live in or are also traveling to the trip destination
- Store the selected availability slots per trip day (current behavior writes all slots as default `true`; new behavior writes only the selected slots as `true`, others as `false`)

**2. Create a `trips` table** (new database migration)
- Columns: `id`, `user_id`, `start_date`, `end_date`, `location`, `available_slots` (text array of selected time slots), `priority_friend_ids` (uuid array), `created_at`, `updated_at`
- RLS: users can CRUD their own trips; friends can SELECT trips where they're in `priority_friend_ids`
- This replaces the implicit "trip = consecutive away days" detection with explicit trip records
- The existing availability upsert logic continues to mark days as away, but now references the trip record

**3. Update availability upsert logic** (`AddTripDialog.tsx` save handler)
- When saving a trip, write only the user-selected time slots as `true` in the availability table (others `false`)
- Insert/update the corresponding `trips` table row
- On delete, also delete the `trips` row

**4. Show priority friends on trip UI** 
- In `LocationTimeline.tsx`: when displaying a trip block, show small avatar chips of priority friends beneath the trip bar
- In `AvailabilityGrid` / `DaySummaryDropdown`: for away days linked to a trip with priority friends, show a subtle "Want to see: [names]" note

**5. Notify priority friends** (optional enhancement)
- When a user saves a trip with priority friends, create smart nudges for those friends: "[Name] is visiting [Location] from [Date]–[Date] and wants to hang out!"

### Technical Details

- New migration creates the `trips` table with appropriate RLS policies
- `AddTripDialog` gains two new collapsible sections below the date pickers
- Friend picker reuses the same searchable pattern from `QuickPlanSheet` (filter connected friends, display as removable chips)
- Time slot picker uses a simple 6-toggle grid matching `TIME_SLOT_LABELS`
- The `TripData` interface expands to include `id?: string`, `availableSlots?: TimeSlot[]`, `priorityFriendIds?: string[]`
- Existing trip detection logic in `LocationTimeline` switches to querying the `trips` table instead of inferring from consecutive away days

### Files Modified
- `src/components/profile/AddTripDialog.tsx` — major UI expansion
- `src/components/profile/LocationTimeline.tsx` — show priority friends on trip blocks
- `src/components/availability/DaySummaryDropdown.tsx` — show "want to see" note on away days
- `src/types/planner.ts` — expand `TripData` type
- New migration for `trips` table

