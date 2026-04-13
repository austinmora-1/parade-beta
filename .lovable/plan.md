

# Plan: Group Trip Planning Wizard (Updated)

## Overview
Build a "Plan a Trip" wizard that helps users find optimal trip dates with friends by analyzing availability and existing trips across user-selected months, then lets users select and share up to 5 potential trip date ranges.

## User Flow

```text
Step 1: Select friend(s) to trip with
Step 2: Select individual months (non-consecutive allowed, e.g. July, Aug, Oct)
Step 3: System shows weekends ranked by combined availability + no trip conflicts
Step 4: User selects up to 5 date ranges from the results
Step 5: Confirmation & share trip proposals with friends
```

## Implementation

### 1. New component: `src/components/trips/GuidedTripSheet.tsx`
Drawer-based wizard modeled after `GuidedPlanSheet.tsx`.

**Step 1 — Friend selector**: Reuse friend search pattern from GroupScheduler.

**Step 2 — Month picker (non-consecutive)**: Display a grid of the next 6–12 months as toggle buttons. Users tap to select/deselect individual months freely — no requirement for consecutive selection. Selected months shown as highlighted chips. Minimum 1 month required.

**Step 3 — Weekend analysis**: For each weekend (Fri–Sun) across all selected months:
- Fetch all participants' `availability` rows and `trips`
- Count available slots per participant, penalize weekends with existing trip conflicts
- Sort by score DESC then chronologically
- Display as ranked weekend cards with availability percentage

**Step 4 — Date range selection**: User taps up to 5 weekends. Optional destination city input.

**Step 5 — Confirmation & share**: Summary + create trip proposal records.

### 2. Database migration
Three new tables: `trip_proposals`, `trip_proposal_dates`, `trip_proposal_participants` with RLS policies allowing creator to manage, participants to view/vote.

### 3. Entry point
Add "Plan a Trip" button on `src/pages/Trips.tsx` alongside existing "Add Trip".

### 4. Weekend scoring
```text
For each weekend in selected months:
  availabilityScore = sum of free slots across all participants
  conflictPenalty = -1000 if any participant has existing trip
  finalScore = availabilityScore + conflictPenalty
Sort by finalScore DESC, then chronologically
```

### Files to create/modify
- **Create**: `src/components/trips/GuidedTripSheet.tsx` (~500 lines)
- **Modify**: `src/pages/Trips.tsx` (add entry point button)
- **Migration**: New tables for trip proposals

