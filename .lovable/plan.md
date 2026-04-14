

## Plan: Trip vs Visit Sub-track

### Overview

Add a "Trip or Visit?" type selector to the trip proposal system. A **Trip** means the group is traveling to a non-home destination. A **Visit** means one person is hosting at their home base and others are traveling to them (or vice versa). The system reuses all existing proposal infrastructure (date voting, availability analysis, participant management) but adapts language, icons, and destination logic based on the type.

### Database Changes

**Migration: Add `proposal_type` and `host_user_id` columns to `trip_proposals`**

```sql
ALTER TABLE public.trip_proposals
  ADD COLUMN proposal_type text NOT NULL DEFAULT 'trip',  -- 'trip' | 'visit'
  ADD COLUMN host_user_id uuid;  -- the person whose home base is the destination (for visits)
```

No new tables needed — the existing `trip_proposals`, `trip_proposal_dates`, and `trip_proposal_participants` tables handle everything.

### Frontend Changes

#### 1. GuidedTripSheet — Add type selection step (`src/components/trips/GuidedTripSheet.tsx`)

- Insert a new step **after friend selection** and **before months**: `'type'`
- Step flow becomes: `friends → type → months → weekends → confirm`
- The type step offers two cards:
  - **"Plan a Trip"** (Plane icon) — "Travel somewhere together" → sets `proposalType = 'trip'`
  - **"Plan a Visit"** (Home icon) — "Visit a friend's city or host them at yours" → sets `proposalType = 'visit'`
- When "Visit" is selected, show a sub-choice: **"I'm hosting"** (destination auto-set to current user's home_address) vs **"I'm visiting"** (show a picker of selected friends' home cities as destination options)
- For visits, the destination field on the confirm step is pre-filled and read-only (set to the host's home city)
- On submit, write `proposal_type` and `host_user_id` to the `trip_proposals` row

#### 2. TripsList — Differentiate Trip vs Visit cards (`src/components/trips/TripsList.tsx`)

- Read `proposal_type` and `host_user_id` from the proposal data
- **Visit proposals** show:
  - Home icon instead of Plane icon
  - Title: "Visit to {city}" or "{host_name} is hosting in {city}" instead of "Trip to {destination}"
  - Badge: "Visit" instead of "Proposed"
- **Trip proposals** remain unchanged (Plane icon, "Trip to {destination}", "Proposed" badge)

#### 3. TripProposalsList (dashboard widget) — Same language updates (`src/components/trips/TripProposalsList.tsx`)

- Mirror the same icon/title/badge logic as TripsList

#### 4. Push notification language (`src/components/trips/GuidedTripSheet.tsx` submit handler)

- Trip: `"{name} shared trip options to {dest} with you"` (existing)
- Visit: `"{name} wants to plan a visit to {city}"` or `"{name} is hosting in {city} — vote on dates!"`

#### 5. Trips page — Add "Plan a Visit" button (`src/pages/Trips.tsx`)

- Add a second button alongside "Plan a Trip": **"Plan a Visit"** with Home icon
- Opens the same GuidedTripSheet but with `preSelectedType = 'visit'` prop to skip the type step or pre-select it

### Files to Modify

| File | Change |
|---|---|
| `supabase/migrations/` | New migration adding `proposal_type` and `host_user_id` columns |
| `src/components/trips/GuidedTripSheet.tsx` | Add type step, host selection, adapt language and submission |
| `src/components/trips/TripsList.tsx` | Read proposal_type, adapt icons/titles/badges |
| `src/components/trips/TripProposalsList.tsx` | Same icon/title/badge adaptation |
| `src/pages/Trips.tsx` | Add "Plan a Visit" button |

### Language Summary

| Context | Trip | Visit (hosting) | Visit (visiting) |
|---|---|---|---|
| Card title | "Trip to {dest}" | "{host} is hosting in {city}" | "Visit to {city}" |
| Icon | ✈️ Plane | 🏠 Home | 🏠 Home |
| Badge | Proposed | Visit | Visit |
| Notification | "shared trip options" | "is hosting in {city}" | "wants to visit {city}" |
| Confirm emoji | ✈️ | 🏠 | 🏠 |

