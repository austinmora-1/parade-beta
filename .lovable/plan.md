
# Active Safeguards

## Split-Location Departure City Fallback (April 2026)

### What was fixed
Flight transition days (e.g., Dallas → New York) were showing only the destination city instead of a "departure → arrival" arrow indicator.

### Root causes (3 bugs)
1. **`src/stores/plannerStore.ts`**: Null slot locations (in-transit gaps) were dropped when mapping DB rows to `DayAvailability.slotLocations` — only truthy values were kept. Fix: include all `val !== undefined` entries so `null` (transit) slots are preserved.
2. **`src/components/plans/WeeklyPlanSwiper.tsx`**: `getPreviousDayLocation` used DB column names (`slot_location_late_night`) instead of TimeSlot keys (`late-night`). Fix: use correct keys.
3. **`src/stores/plannerStore.ts`** (extended range loader ~line 1407): `slotLocations` weren't mapped at all for lazy-loaded availability. Fix: added the same slot mapping logic.

### Critical invariants — DO NOT REGRESS
- `slotLocs` must include **null** entries (not just truthy ones) so the client can detect in-transit slots
- `getPreviousDayLocation` must use TimeSlot keys (`'late-night'`, `'evening'`, etc.), NOT DB column names
- Both the initial load (~line 521) and extended range loader (~line 1407) must map `slotLocations`
- `getLocationLabel` falls back to previous day's last known location when only one unique city + transit exists in slots

### Files involved
| File | Lines | What to protect |
|------|-------|-----------------|
| `src/stores/plannerStore.ts` | ~521-527 | `val !== undefined` check (not `if (val)`) |
| `src/stores/plannerStore.ts` | ~1407-1440 | Extended range loader includes `slotLocations` mapping |
| `src/components/plans/WeeklyPlanSwiper.tsx` | `getLocationLabel` | Single-city + transit → infer departure from previous day |
| `src/components/plans/WeeklyPlanSwiper.tsx` | `getPreviousDayLocation` | Uses TimeSlot keys, not DB column names |
| `supabase/functions/_shared/calendar-helpers.ts` | `resolveSlotLocations` | Checks `result` map (prev day slots) before `locationByDate` fallback |
