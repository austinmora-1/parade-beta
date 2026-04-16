

## Goal

Allow users to share a Plan or a Trip/Visit invite via a public link that works for non-users, triggered from:
1. The **Share** action on a Plan card or Trip/Visit card (and detail pages)
2. **During creation** in the Guided Plan / Guided Trip sheets ("Generate shareable link")

## What's already built (reuse)

Plans already have most of this:
- `InviteToPlanDialog` generates a token-based link via the `plan_invites` table
- `/plan-invite/:token` page (`src/pages/PlanInvite.tsx`)
- `public/invite.html` redirector with OG tags for link previews
- Wired to plan cards (`onSharePlan`) and `PlanDetail`

## What's missing / to build

### 1. Trip/Visit invite infrastructure (new — mirrors plan_invites)

**New table `trip_proposal_invites`**:
- `id`, `proposal_id` (FK trip_proposals), `trip_id` (FK trips, nullable for finalized trips), `invite_token` (unique), `invited_by`, `email` (nullable), `status` (`pending` / `accepted`), `accepted_by`, `accepted_at`, `created_at`
- RLS: creator manages own invites; public read by token via SECURITY DEFINER RPCs

**New RPCs**:
- `get_trip_invite_details(p_token)` — returns destination, date options, host name/avatar, participant count, status. Public.
- `accept_trip_invite(p_token)` — adds caller to `trip_proposal_participants` (or `trips` if finalized) and marks invite accepted. Auth required.

### 2. New page `/trip-invite/:token` (`src/pages/TripInvite.tsx`)

Mirrors `PlanInvite.tsx`:
- Public — fetches details via the new RPC
- Shows destination, proposed dates, host + invitee count, Parade branding
- **Non-user flow**: full read-only details; signup/login required only to RSVP/rank dates (gates the action button only)
- After signup → returns to `/trip-invite/:token` → auto-accepts → redirects to `/trip/:id`

Update `public/invite.html` to also handle `?tt=<token>` and redirect to `/trip-invite/...`. Add the route in `App.tsx`.

### 3. New `InviteToTripDialog` component

Same UX as `InviteToPlanDialog` (email / SMS / Generate Link). Reuses the existing `send-sms-invite` edge function and adds a parallel `send-trip-invite` edge function for branded email (mirrors `send-plan-invite`).

### 4. Wire up triggers

- **Trip cards** (`TripsList.tsx`): add a small Share icon next to the existing UserPlus / Convert icons on both confirmed trips and proposal cards
- **Trip detail** (`TripDetail.tsx`): add a Share button in the header
- **GuidedTripSheet**: after a proposal/trip is created, surface a "Plan Created" follow-up dialog with the shareable link (copy + email + SMS)
- **GuidedPlanSheet**: same — surface the link in a follow-up summary dialog after creation, reusing `InviteToPlanDialog`

This consistent post-create dialog means users can immediately share with non-Parade friends without needing to find the card again.

### 5. OG image

Reuse the existing `og-invite-image` edge function. Future enhancement (not v1): render destination/dates dynamically.

## File change summary

**New**:
- `supabase/migrations/<ts>_trip_invites.sql`
- `src/pages/TripInvite.tsx`
- `src/components/trips/InviteToTripDialog.tsx`
- `supabase/functions/send-trip-invite/index.ts`

**Modified**:
- `public/invite.html` — handle `?tt=` token
- `src/App.tsx` — add `/trip-invite/:token` route
- `src/components/trips/TripsList.tsx` — Share icon on trip + proposal cards
- `src/pages/TripDetail.tsx` — Share button in header
- `src/components/trips/GuidedTripSheet.tsx` — post-create share dialog
- `src/components/plans/GuidedPlanSheet.tsx` — post-create share dialog (reuses existing infra)

## Behavior summary

- **Non-user opens link** → sees full plan/trip details (read-only). Clicking "Join" prompts signup → auto-accepts on return.
- **Existing user opens link** → auto-redirected to `/plan/:id` or `/trip/:id`, added as participant.
- **Creator** can grab a shareable link from: (a) the Share action on the card, (b) the detail page header, or (c) the post-create summary dialog.

