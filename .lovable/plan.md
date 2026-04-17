

## Goal
Change the inline location-set in `GreetingHeader` so it defaults to setting **today's current location only** (via `availability` table), with an opt-in checkbox to also persist as **home base** (via `profiles.home_address`).

## Current behavior
The popover's `handleSaveLocation` writes to `profiles.home_address` + `timezone` directly, treating it as permanent home.

## New behavior

When user opens the popover from "Set location":
1. **Default action** — save as today's current location:
   - Upsert into `availability` for today's date with `location_status='away'`, `trip_location=<city>`. This mirrors how `LocationToggle` / trip auto-creation already works and will flow through the existing trip-merging trigger.
2. **Optional checkbox** — "Also save as my home location":
   - When checked, additionally update `profiles.home_address` and `timezone`, and call `updateProfile(...)` to refresh local state.

## UI changes (`src/components/dashboard/GreetingHeader.tsx`)

Inside the popover, below `CityAutocomplete`, add:
```
[ ] Also save as my home location
```
Using the existing `Checkbox` component from `@/components/ui/checkbox`.

State additions:
- `saveAsHome: boolean` (default `false`)

Reset `saveAsHome` to `false` whenever popover opens (alongside `locationDraft`).

## Save logic rewrite

```ts
const handleSaveLocation = async () => {
  const trimmed = locationDraft.trim();
  if (!trimmed || !user?.id) return;
  setSavingLocation(true);
  try {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const tz = getTimezoneForCity(trimmed) || profile?.timezone || null;

    // 1. Always: set today's current location via availability upsert
    const { error: availErr } = await supabase
      .from('availability')
      .upsert(
        {
          user_id: user.id,
          date: todayKey,
          location_status: 'away',
          trip_location: trimmed,
        },
        { onConflict: 'user_id,date' }
      );
    if (availErr) throw availErr;

    // 2. Optional: persist as home
    if (saveAsHome) {
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ home_address: trimmed, ...(tz ? { timezone: tz } : {}) })
        .eq('user_id', user.id);
      if (profErr) throw profErr;
      updateProfile({ home_address: trimmed, ...(tz ? { timezone: tz } : {}) });
    }

    // 3. Refresh planner store so today's availability reflects new location
    await usePlannerStore.getState().reloadAvailability?.();
    
    toast.success(saveAsHome ? 'Location saved as home' : 'Current location set');
    setLocationOpen(false);
    setLocationDraft('');
    setSaveAsHome(false);
  } catch (err: any) {
    toast.error(err.message || 'Failed to save location');
  } finally {
    setSavingLocation(false);
  }
};
```

Note: I'll verify `plannerStore` has a refresh method for availability (likely `loadAvailability` or via `useAvailabilityStore`); if not, fall back to manually patching the local store similar to how `LocationToggle` does it. Will inspect during implementation.

## Files touched
- `src/components/dashboard/GreetingHeader.tsx` — add checkbox, refactor save logic, import `Checkbox` and `usePlannerStore` already imported.

## Verification
1. Open dashboard with no `home_address` set → "Set location" appears.
2. Pick city, leave checkbox unchecked → Save → today's `currentCity` updates to that city, but `profile.home_address` remains null (next day's view falls back to "Set location" again unless next day also away).
3. Same flow with checkbox checked → both today's availability and profile home are updated; persists across days.

