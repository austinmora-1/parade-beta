# Rename "Trip" entry to "Plan a Trip"

Small copy tweak in the unified "What are you planning?" entry sheet (and the existing FAB menu it replaces).

## Change

In the new `WhatArePlanningSheet` menu, the third option label changes:

```text
Before:  📍 Trip            — "NYC this fall — or Queens Saturday"
After:   📍 Plan a Trip     — "NYC this fall — or Queens Saturday"
```

Sub-copy and icon stay the same. All other entry labels ("Hang with someone", "Get a plus-one", "Free weekend", "Invite friends") are unchanged.

## Files touched

- `src/components/dashboard/WhatArePlanningSheet.tsx` *(being created in the v2.1 plan)* — update the label string for the trip entry.
- `src/components/dashboard/GreetingHeader.tsx` — if the label is also referenced here for the interim FAB, update to match.

No other behavior, routing, or step changes.
