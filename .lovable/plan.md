

# Sprint C: Store Split + Component Decomposition

## Summary

Two high-impact refactors: (1) split the 1200-line `plannerStore.ts` into 4 focused domain stores with a backward-compatible facade, and (2) decompose the 6 largest components (1000+ lines each) and lazy-load their dialog children.

---

## C3.1 — Split plannerStore into 4 Domain Stores + Facade

The current monolith has 4 clear domains mixed together. Every selector re-renders on any state change. Splitting lets Zustand skip re-renders when unrelated state changes.

### New files

| File | Domain | State | Actions |
|------|--------|-------|---------|
| `src/stores/plansStore.ts` | Plans | `plans`, `hasMorePlans`, `isLoadingMore` | `addPlan`, `updatePlan`, `deletePlan`, `proposePlan`, `respondToProposal`, `loadPlans`, `loadMorePlans` |
| `src/stores/friendsStore.ts` | Friends | `friends` | `addFriend`, `updateFriend`, `acceptFriendRequest`, `removeFriend`, `loadFriends` |
| `src/stores/availabilityStore.ts` | Availability | `availability`, `availabilityMap`, `locationStatus`, `defaultSettings`, `homeAddress` | `setAvailability`, `setLocationStatus`, `getLocationStatusForDate`, `setVibeForDate`, `getVibeForDate`, `loadAvailabilityForRange`, `initializeWeekAvailability`, `loadProfileAndAvailability` |
| `src/stores/vibeStore.ts` | Vibe/Profile | `currentVibe`, `userTimezone` | `setVibe`, `addCustomVibe`, `removeCustomVibe` |

### Facade (keeps existing imports working)

`src/stores/plannerStore.ts` becomes a thin re-export:

```typescript
export const usePlannerStore = create<PlannerState>((set, get) => {
  // Subscribe to all 4 stores, merge state
  // Delegate actions to domain stores
});
```

This means **zero changes needed in the 50+ consumer files initially**. Consumers can be migrated to direct imports incrementally later.

### Orchestration

- `loadAllData` stays in the facade — it calls the dashboard RPC and distributes results to each domain store via `.setState()`.
- `forceRefresh` resets all stores' `lastFetchedAt`.
- The IndexedDB cache logic stays in the facade.

### Shared state

- `userId` and `isLoading` live in the facade since they're cross-cutting.
- Domain stores accept `userId` as a parameter to their async actions rather than storing it.

---

## C4.1 — Giant Component Decomposition

Target the 6 components over 900 lines:

| Component | Lines | Split strategy |
|-----------|-------|----------------|
| `CreatePlanDialog.tsx` (1245) | Extract: `PlanFormFields`, `ParticipantPicker`, `DateTimePicker`, `RecurrenceConfig` |
| `GuidedTripSheet.tsx` (1231) | Extract: `TripStepDates`, `TripStepDestination`, `TripStepParticipants`, `TripStepReview` |
| `Settings.tsx` (1102) | Extract: `SettingsProfile`, `SettingsCalendar`, `SettingsNotifications`, `SettingsPrivacy`, `SettingsDanger` |
| `GuidedPlanSheet.tsx` (1088) | Extract: `PlanStepActivity`, `PlanStepWhen`, `PlanStepWho`, `PlanStepDetails` |
| `WeeklyPlanSwiper.tsx` (966) | Extract: `DayColumn`, `PlanCard`, `SwiperControls` |
| `Profile.tsx` (902) | Extract: `ProfileHeader`, `ProfileStats`, `ProfileTripsList`, `ProfilePlanHistory` |

Each parent component becomes an orchestrator (~100-200 lines) that imports sub-components.

---

## C4.2 — Lazy Dialogs

Wrap infrequently-used dialogs with `React.lazy` + `Suspense`:

- `CreatePlanDialog`
- `GuidedPlanSheet`
- `GuidedTripSheet`
- `MergePlansDialog`
- `InviteToPlanDialog`
- `SuggestFriendDialog`
- `InviteFriendDialog`
- `AddTripDialog`
- `ImageCropDialog`
- `DeleteAccountDialog`
- `ShareDialog`

Pattern:
```typescript
const LazyCreatePlanDialog = lazy(() => import('@/components/plans/CreatePlanDialog'));

// In JSX:
{editDialogOpen && (
  <Suspense fallback={null}>
    <LazyCreatePlanDialog ... />
  </Suspense>
)}
```

Conditionally render on the `open` prop so the chunk isn't fetched until the dialog is actually opened.

---

## Execution Order

1. **C4.2 — Lazy dialogs** (lowest risk, immediate bundle win, no logic changes)
2. **C4.1 — Component decomposition** (pure extraction, no behavior changes)
3. **C3.1 — Store split** (highest risk, do last with tests)

Each step is independently shippable and testable.

---

## Technical Notes

- All extracted sub-components go in the same directory as their parent (e.g., `src/components/plans/create-plan/PlanFormFields.tsx`).
- The store facade preserves the exact `PlannerState` interface so TypeScript catches any missed fields.
- Lazy imports use default exports for compatibility with `React.lazy`.
- The helper files (`mapAvailability.ts`, `mapPlans.ts`, `mapFriends.ts`, `types.ts`) stay as-is — they're already well-factored.

