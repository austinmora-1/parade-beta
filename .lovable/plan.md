## Problem

The current ParadeTour uses `react-joyride` + Vaul `Drawer` + an async `before` hook + a fake "tooltip anchor" element. Three things fight each other:

1. **Vaul listens for outside pointer events.** When the user clicks the joyride "Next" button (rendered in a portal on `body`), Vaul treats it as outside-click and tries to close the drawer. `dismissible={false}` blocks the close but still consumes the event and triggers a re-layout — that's why "Next" needs two clicks and the tooltip jumps to the top.
2. **Async `before` hooks + transient anchor div** mean joyride sometimes measures the anchor before the drawer's slide-in transform finishes, so the highlight lands on the wrong square.
3. **The "tour cancels after step 2"** is Vaul's drag-to-dismiss reacting to scroll/touch on the joyride overlay, which removes the drawer mid-step and leaves joyride with no target.

## Solution: Replace react-joyride entirely with a purpose-built lightweight tour

A custom 7-step tour component that we fully control. No portal/drawer conflicts, deterministic positioning, single-click advance.

### Architecture

```text
ParadeTour (single component)
  ├─ Backdrop (fixed, full screen, z-[9000])
  ├─ Spotlight cutout (SVG mask over backdrop, recomputed on each step)
  ├─ Tooltip card (fixed, z-[9020], position chosen per step)
  └─ Inline planning panel (NOT a Drawer — rendered directly inside the tour for steps 2-4)
```

Key change: **for steps 2-4 we render the planning options as part of the tour itself**, not via the real `WhatArePlanningSheet` Drawer. The user sees the same three options in the same bottom-sheet visual style, but it's a plain `<div>` we own, so there's no Vaul to fight. Steps 1, 5, 6, 7 spotlight real DOM targets (FAB, nav-plans, nav-trips, invite-friends) like before.

### Step list

| # | Target | Behavior |
|---|--------|----------|
| 1 | `[data-tour="fab"]` | Spotlight the + button. Tooltip below. |
| 2 | Tour-owned "Find time with friends" row | Bottom panel slides up; row 1 highlighted; tooltip above the panel. |
| 3 | Tour-owned "Open invite" row | Same panel stays open; row 2 highlighted; tooltip above. |
| 4 | Tour-owned "Go somewhere" row | Same panel stays open; row 3 highlighted; tooltip above. |
| 5 | `[data-tour="nav-plans"]` | Panel dismounts. Navigate to `/availability`. Spotlight Plans nav. |
| 6 | `[data-tour="nav-trips"]` | Navigate to `/trips`. Spotlight Trips nav. |
| 7 | `[data-tour="invite-friends"]` | Navigate to `/friends`. Spotlight invite button. |

### Why this fixes every issue

- **No more "Next" needing two clicks** — buttons live in our own component, not in a portal that Vaul intercepts.
- **No more wrong-square highlight** — for steps 2-4, the spotlight target is a child of our own tour panel, so we measure it after our own mount/animation completes. No race.
- **No more tour cancellation** — the drawer is gone for tour steps; nothing can "dismiss" the panel except the tour's own Skip/Close buttons.
- **No more tooltip overlapping the sheet** — we control both, so the tooltip is positioned exactly above the panel's known top edge (`bottom: panelHeight + 12px`).

### Spotlight & positioning rules

- Spotlight: SVG `<mask>` cutout with 8px padding, 14px radius. Recomputed via `getBoundingClientRect()` on step change + `ResizeObserver` + `window.resize`.
- Tooltip placement: declarative per-step (`'top' | 'bottom'`), with viewport clamping (min 12px from edges).
- Panel for steps 2-4: `position: fixed; bottom: 0; left: 0; right: 0;` with a `framer-motion` slide-in. Mounts on entering step 2, unmounts on leaving step 4.

### Persistence & replay

- Same DB field: `profiles.walkthrough_completed`.
- Same replay key: `localStorage['parade.tour.replay'] = '1'` + `startParadeTour()` export keeps existing entry points working.

### Files

**Rewrite**
- `src/components/onboarding/ParadeTour.tsx` — full rewrite as a self-contained tour. Removes all `react-joyride` usage.

**Revert / simplify**
- `src/components/dashboard/WhatArePlanningSheet.tsx` — remove the `tourMode` prop and `dismissible={!tourMode}` (no longer needed).
- `src/components/dashboard/GreetingHeader.tsx` — remove the `parade:open-planning-sheet` / `parade:close-planning-sheet` event listeners and `planningSheetTourMode` state.

**Untouched**
- `Dashboard.tsx` — still renders `<ParadeTour />` at the top.
- All `data-tour` attributes on FAB, nav items, invite button stay as-is.

### Dependency

`react-joyride` will no longer be imported. We can leave the package installed (no-op) to avoid touching `package.json`.

### Acceptance criteria

1. Tour runs all 7 steps end-to-end with single Next clicks.
2. Steps 2-4: highlight is perfectly aligned to the correct option row; tooltip sits above the panel without overlap.
3. Tour never auto-closes between steps.
4. Back button works on all steps including 2→1 and 5→4 (re-mounts the panel).
5. Skip and final "Let's go!" both mark `walkthrough_completed = true`.
