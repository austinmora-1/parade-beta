

## Fix: Show Per-Date Location Context in Plan Creation

### Problem
The current UI shows each person's **current city** (today) at the top, but suggested time slots can be weeks or months in the future when locations may differ. The user sees "You: San Francisco" but can't verify whether Dean will also be in San Francisco on April 17-18. The co-location filter runs correctly, but the UI doesn't communicate **where** both parties will be on each suggested date.

### Solution

**1. Track the shared city per suggested slot**

Extend the `BestSlot` interface to include a `sharedCity` field. During the 180-day scan, when a slot passes the co-location check, store the matched city name on the result. This captures the city context for each specific date, not just today.

**2. Replace the static city labels with per-slot location context**

Remove the current "You: San Francisco / Dean: Reno" static labels from the top of the time-selection step. Instead, display the shared city on each suggested time card (e.g., "📍 San Francisco" below the date/slot label). This way each suggestion is self-documenting.

**3. Group suggestions by city when friends overlap in multiple locations**

If the 6-month scan finds co-located slots in different cities (e.g., both in SF for some dates, both in NYC for others), group the suggestions by city with a small section header like "In San Francisco" / "In New York City". Show up to 3 slots per city group, displayed as swipeable horizontal pages so the user can browse location-based options.

### Technical Details

**File: `src/components/plans/GuidedPlanSheet.tsx`**

- Add `sharedCity: string` to the `BestSlot` interface
- In the scan loop (line ~200), when `coLocated` is true, capture the resolved city: `const sharedCity = myCity || friendCity`
- Pass `sharedCity` into each `BestSlot` result object
- Remove the static `myCity` / `friendCities` display block (lines 380-399) from the time step (keep it on activity step if desired)
- Group `bestSlots` by `sharedCity` after sorting
- Render grouped slots with city headers. If multiple city groups exist, use a horizontal swiper (CSS `snap-x` scroll) with dot indicators so users can browse "In San Francisco (3 times)" vs "In New York (2 times)"
- Show the shared city on each slot card as a small `MapPin` label
- On the confirmation step, display the shared city in the summary card

**No database or backend changes required** — this is purely a UI/display improvement using data already fetched.

