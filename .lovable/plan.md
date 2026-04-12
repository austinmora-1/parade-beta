

## Plan: Improve Trip Detection from Calendar Sync

### Problem
Currently, trip creation from calendar sync only detects flights. It does not detect hotel/Airbnb reservations, and when there's an outbound flight with no detected return flight, the system silently fills forward up to 30 days, which creates incorrect long trips.

### Changes

#### 1. Add Hotel/Reservation Detection to Sync Functions
**Files:** `supabase/functions/google-calendar-sync/index.ts`, `supabase/functions/calendar-sync-worker/index.ts`, `supabase/functions/ical-sync/index.ts`

- Add `isHotelEvent()` detector: match keywords like "hotel", "airbnb", "vrbo", "reservation", "check-in", "check-out", "stay at", "lodging", "accommodation", common hotel brand names (Marriott, Hilton, Hyatt, etc.)
- Add `extractHotelLocation()`: pull location from event location field or summary
- Build a `hotelStaysByDate` map similar to `flightLocationByDate`, marking all dates from check-in to check-out as "away" at the hotel's location
- When both a flight and hotel overlap for the same destination, use flight dates (flight takes priority per requirement)

#### 2. Track "One-Way Flights" (Outbound Without Return)
**Files:** `supabase/functions/google-calendar-sync/index.ts`, `supabase/functions/calendar-sync-worker/index.ts`, `supabase/functions/ical-sync/index.ts`

- After processing all flights, identify outbound flights that have no corresponding return flight within 30 days
- For these, instead of silently filling forward 30 days, store a flag in the trip record or a new `pending_return_trips` table so the client knows to prompt the user
- Stop the gap-filling at a reasonable limit (e.g., 7 days instead of 30) when no return flight is found

#### 3. Create "Missing Return Flight" Dialog
**File:** New `src/components/trips/MissingReturnDialog.tsx`

- Dialog that appears after calendar sync completes when one-way outbound flights are detected
- Shows the trip destination and departure date
- Options: "Sync return flight" (prompts re-sync or manual calendar add), "Add return date manually" (date picker), "Skip" (dismiss)
- On manual return date selection, update the trip's `end_date` and fill availability accordingly

#### 4. Integrate the Dialog into Sync Flow
**Files:** `src/hooks/useGoogleCalendar.ts`, `src/hooks/useAppleCalendar.ts`, `src/pages/Availability.tsx`

- After `syncCalendar()` returns, check if the response includes `pendingReturnTrips` (trips with outbound but no return)
- If so, open the `MissingReturnDialog` with the trip details
- On user action, update the trip record and availability accordingly

#### 5. Database Changes
- Add a `needs_return_date` boolean column to the `trips` table (default false) to flag trips that were auto-created from one-way flights
- The sync functions set this flag; the dialog clears it when the user provides a return date

### Technical Details
- Hotel detection regex: `/\b(hotel|airbnb|vrbo|booking|reservation|check[\s-]?in|check[\s-]?out|stay\s+at|lodging|accommodation|marriott|hilton|hyatt|sheraton|westin|holiday\s*inn|hampton|doubletree|courtyard|residence\s*inn|ritz|four\s*seasons|intercontinental|radisson)\b/i`
- Hotel location extraction: prefer event `location` field, then parse from summary
- Flight-hotel priority: when both exist for the same destination, use flight departure as start and flight return as end; fall back to hotel dates if only hotel exists

