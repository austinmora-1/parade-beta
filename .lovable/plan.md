

## Update Early Morning Time Slot Boundary

**What changes**: The "Early Morning" time slot currently covers 6am-9am. It needs to be expanded to cover 2am-9am, so that flights and events starting between 2am and 6am (like a 4:55am flight) are categorized as "Early Morning" instead of "Late Night".

**Late Night** will now only cover 10pm-2am (hours 22, 23, 0, 1).

### Files to update

All 5 locations where `getTimeSlot` logic exists:

1. **`supabase/functions/google-calendar-sync/index.ts`** — change `hour >= 6 && hour < 9` to `hour >= 2 && hour < 9`
2. **`supabase/functions/ical-sync/index.ts`** — same change
3. **`supabase/functions/calendar-sync-worker/index.ts`** — same change
4. **`supabase/functions/nylas-sync/index.ts`** — same change
5. **`src/lib/timezone.ts`** (`getTimeSlotForTime`) — change `h >= 6 && h < 9` to `h >= 2 && h < 9`

In each function, the early morning check must come before the fallback to `late_night`, so late night will implicitly cover hours 22-1 (10pm to 2am).

### Edge function redeployment

All four updated edge functions will be redeployed.

