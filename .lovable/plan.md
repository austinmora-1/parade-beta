## The problem

Even though `ElephantLoader` already uses a seeded PRNG so every instance renders the **same particle layout**, users still see the burst happen in **two different positions on the screen** during a normal sign-in → dashboard load. The "two confetti positions" the user is seeing are not two different particle layouts — they are the **same loader rendered in two different containers**, one centered in the viewport and the next anchored inside the page content area.

### What's actually happening on a fresh load

For an authenticated user landing on `/`:

1. **Loader A — fullscreen, viewport-centered.** While `useAuth()` is resolving, `RootRoute` (and `ProtectedRoute` / `LazyFallback`) render:
   ```text
   <div className="min-h-screen flex items-center justify-center bg-background">
     <ElephantLoader />
   </div>
   ```
   The burst sits at the exact center of the screen.

2. **Loader B — inside `AppLayout`, offset by header + nav.** Once auth resolves, `<AppLayout><Dashboard /></AppLayout>` mounts. `Dashboard` then shows its own loader while `isLoading || checkingOnboarding` is true:
   ```text
   <div className="flex h-64 items-center justify-center">
     <ElephantLoader />
   </div>
   ```
   This sits inside `<main>` (which has top padding for the mobile header and bottom padding for the nav), and it's only `h-64` tall — so the burst lands noticeably higher and shifted relative to Loader A.

The result: the elephant/confetti appears, vanishes, and reappears a few hundred pixels away — reading as "two different loading states" even though it's the same component.

### Where else the same offset mismatch occurs

Every place that wraps `ElephantLoader` in its own ad-hoc container reproduces the issue:

| File | Container | Position |
|---|---|---|
| `src/App.tsx` ×4 (`ProtectedRoute`, `RootRoute`, `PublicRoute`, `LazyFallback`) | `min-h-screen flex items-center justify-center` | Viewport center |
| `src/pages/Dashboard.tsx` | `flex h-64 items-center justify-center` | Inside AppLayout, ~top |
| `src/pages/PlanDetail.tsx`, `ProposalDetail.tsx`, `Profile.tsx`, `Settings.tsx`, `Share.tsx`, `PlanInvite.tsx`, `TripInvite.tsx`, `Invite.tsx`, `GoogleCallback.tsx`, `ResetPassword.tsx` | mixed: `min-h-screen`, `flex items-center justify-center py-20`, etc. | Varies |

Across navigations the burst origin keeps moving.

## The fix

Make the loader **own its own positioning** so the confetti origin is always the same point on the screen, regardless of which route or layout is showing it. Then collapse the auth + initial-data loading into a single phase so only one loader is ever visible at a time on the first paint.

### 1. Add a `fullscreen` mode to `ElephantLoader`

Update `src/components/ui/ElephantLoader.tsx` to accept a `fullscreen` prop (default `true`). When `fullscreen` is true the component renders its own fixed-position overlay so the burst is always at the same viewport coordinates:

```text
<div class="fixed inset-0 z-40 flex items-center justify-center
            bg-background pointer-events-none">
  …existing 24×24 SVG burst + "Loading…" label…
</div>
```

- `fixed inset-0` → identical center every time, immune to header/nav padding and parent height.
- `bg-background` → covers any partially-rendered content underneath so transitions between Loader A and Loader B feel like one continuous loader.
- `z-40` → sits above page content but below toasts/dialogs (`z-50`).
- A non-fullscreen variant (`fullscreen={false}`) is preserved for the few places where an inline loader inside a card/section is intentional (e.g. small widgets), but they will not be used for whole-page loading.

### 2. Replace ad-hoc loader wrappers with the new component

Remove the `min-h-screen flex …` / `flex h-64 …` wrappers and just render `<ElephantLoader />` directly in:

- `src/App.tsx` — `ProtectedRoute`, `RootRoute`, `PublicRoute`, `LazyFallback` (all 4 sites).
- `src/pages/Dashboard.tsx` — the `isLoading || checkingOnboarding` branch.
- `src/pages/PlanDetail.tsx`, `ProposalDetail.tsx`, `Profile.tsx`, `Settings.tsx`, `Share.tsx`, `PlanInvite.tsx`, `TripInvite.tsx`, `Invite.tsx`, `GoogleCallback.tsx`, `ResetPassword.tsx` — page-level loading branches.

Every full-page loader will now mount with the same fixed overlay, so when `RootRoute` hands off to `Dashboard` the loader appears to **stay in the same place** instead of jumping.

### 3. Collapse the auth → dashboard handoff into one loader phase

Even with consistent positioning, today there are still two distinct loader mounts on first paint (RootRoute → Dashboard). Make `RootRoute` keep showing the loader until the planner store has finished its initial load:

```text
const initialLoadDone = usePlannerStore(s => s.initialLoadDone);

if (loading || (user && !initialLoadDone)) {
  return <ElephantLoader />;
}
```

`initialLoadDone` is set to `true` at the end of `loadAllData()` in `plannerStore`. Dashboard then no longer needs its own page-level loader for the initial load — it can render immediately because the data is guaranteed to be present. (The `checkingOnboarding` check stays, but the rare case where it's still pending also reuses the same fullscreen loader.)

Net effect: one loader mounts, stays in place across the auth → data-load → dashboard handoff, and unmounts exactly once when the dashboard is ready to render.

### 4. Keep the seeded particle layout (already correct)

The existing `seededRandom(1337)` + module-level `PARTICLES` constant already guarantees identical particle geometry across instances, so no change is needed there. The only reason it *looked* different was the container offset — fixed by step 1.

## Files to change

- `src/components/ui/ElephantLoader.tsx` — add `fullscreen` prop and fixed overlay wrapper.
- `src/App.tsx` — simplify the 4 loader sites.
- `src/pages/Dashboard.tsx` — drop the local loader wrapper; gate on `initialLoadDone` upstream.
- `src/stores/plannerStore.ts` — add `initialLoadDone` flag set after `loadAllData()` completes.
- `src/pages/PlanDetail.tsx`, `ProposalDetail.tsx`, `Profile.tsx`, `Settings.tsx`, `Share.tsx`, `PlanInvite.tsx`, `TripInvite.tsx`, `Invite.tsx`, `GoogleCallback.tsx`, `ResetPassword.tsx` — use `<ElephantLoader />` directly.

## Out of scope

- The toast-success confetti bursts (`canvas-confetti`) fired on plan/trip creation in `GuidedPlanSheet`, `GuidedTripSheet`, `QuickPlanSheet`, `RecommendedPlanDialog`, `TripsList`, `Notifications`, `CalendarIntegration` — these are intentional celebration effects, not loading states, and are not part of this fix.
