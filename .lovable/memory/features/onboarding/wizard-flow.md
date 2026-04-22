---
name: Onboarding Wizard
description: 4-step Phase 2 wizard (Welcome → Calendar → Rhythm → Bring someone) plus PolishProfileCard for deferred fields
type: feature
---
**Onboarding flow** (Phase 2 redesign): `OnboardingWizard.tsx` runs 4 steps:
1. `AccountCreationStep` (Welcome) — name, username, phone
2. `CalendarSyncStep` — Google + Apple via Nylas
3. `RhythmStep` — work days + work hours ONLY (slim)
4. `FriendsStep` (Bring someone) — invite by email

Dropped from onboarding (kept in DB / Settings, surfaced via dashboard nudge):
- interests, social_goals, social_cap, preferred_social_times/days
- privacy toggles (show_availability, show_location, show_vibe_status, allow_all_hang_requests)
- profile personalization (avatar, cover photo, home address, neighborhood)

**PolishProfileCard** (`src/components/dashboard/PolishProfileCard.tsx`) renders on Dashboard when ≥3 of {interests, social_goals, social_cap, preferred_social_times} are empty. Dismissal stored in `localStorage` under `parade.polishProfile.dismissed.<userId>`. Links to /settings.

**EllyWalkthrough gating**: Only shows when `friends.length === 0 && plans.length === 0` AND `walkthrough_completed = false`. Reads from `useFriendsStore` / `usePlansStore`.

**Schema**: `profiles` NOT NULL columns are only structural (id, user_id, timestamps, share_code, walkthrough_completed, onboarding_completed). All onboarding fields are already nullable — no migration needed for Phase 2.1.
