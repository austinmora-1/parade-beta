

# Parade Implementation Plan v2 — Phased Build

A 5-phase rollout based on the attached doc, sequenced over ~5 weeks. Phase 1 and Phase 1.5 run partially in parallel; Phase 5 is a parallel native-iOS track.

## Phase 1 · Week 1 — Foundations & quick wins
6 tasks, 0 backend touches, low risk, 3–5 days.

1. **1.1** Rebuild Landing in brand palette (cream/green/coral, Fraunces/Lexend).
2. **1.2** Defer `PushNotificationPrompt` and `DarkModePrompt` behind real triggers (push after first confirmed plan, dark mode after 3rd session).
3. **1.3** Default theme to light (cream) — single change in `App.tsx`.
4. **1.4** Reorder `GuidedPlanSheet`: friends → time → activity → confirm (time-first).
5. **1.5** Retire `CreatePlanDialog` as a creation path (edit-only; `GuidedPlanSheet` is the single creation surface).
6. **1.6** Voice pass across toasts + empty states (system-tone → friend-tone).

## Phase 1.5 · Week 1–2 — Onboarding stickiness unlocks (NEW)
3 tasks, 0 new backend (Nylas already wired), low–medium risk, 2–3 days. Runs in parallel with tail of Phase 1.

1. **1.5.1** Route Apple Calendar through Nylas OAuth in `CalendarSyncStep.tsx` and `Availability.tsx`. Keep iCal URL as collapsed "Other options."
2. **1.5.2** Visually differentiate calendar imports from Parade plans: muted card, "From your calendar" pill, source icon. Add source filter toggle.
3. **1.5.3** Fix layover-as-trip: in `calendar-sync-worker`, add duration (<4h) + airport-code filters before persisting trips. Retroactively delete bogus trips.

## Phase 2 · Week 2 — Onboarding rebuild
5 tasks, 1 schema change, medium risk, 4–6 days.

1. **2.1** Relax profile schema NOT NULL constraints (migration).
2. **2.2** Build new 4-step `OnboardingWizard`: Welcome → Calendar → Rhythm → Bring someone.
3. **2.3** "First window" aha card on dashboard, including a "friend hasn't joined yet" state.
4. **2.4** Invite-to-unlock framing: new `notify-inviter` edge function; push the inviter when their invitee finishes signup. Add progressive-unlock copy in `FriendsStep`.
5. **2.5** Gate `EllyWalkthrough` to truly empty dashboards only.

## Phase 3 · Week 3 — Open-invite primitive + trip/visit split (REBUILT)
6 tasks, 4 backend touches, high risk (new primitives), 6–8 days. Largest phase.

1. **3.1** Migration: `open_invites` + `open_invite_responses` tables, RLS by audience type (all_friends / pod / interest), `convert_open_invite_to_plan()` trigger on first claim.
2. **3.2** Build `OpenInviteSheet` (4 steps: describe → audience → send → confirm) + `useOpenInvites` hook. Add Sidebar "+" entry "Find someone to join me" and a "No one specific" link in `GuidedPlanSheet`.
3. **3.3** New `on-open-invite` edge function: resolve audience, filter by availability overlap, send pushes (cap 50/invite).
4. **3.4** Split `GuidedTripSheet` into `TripSheet` (place-first) and `VisitSheet` (date+place-first). Bundle the 5 trip-flow bug fixes (non-weekend trips, propose-vs-plan label, Convert button, empty-field tap targets, name vs location).
5. **3.5** Plan-first SMS invites: migration adds `phone` + `invitee_name` to `plan_invites`; new `send-plan-invite-sms` edge function (rate-limited, STOP keyword, requires verified inviter phone); `InviteNonUserRow` in `GuidedPlanSheet`. Behind `parade_plan_first_invites` flag.
6. **3.6** Unify `ShareDialog` + `InviteToPlanDialog` into `UnifiedShareSheet` (tabbed; open-invite as third tab for plans).

## Phase 4 · Week 4 — Free-weekend surface & polish
4 tasks, 0 backend, low–medium risk, 3–4 days.

1. **4.1** "Free weekend" dashboard surface: `useOpenWindows` hook (4+ hr block today/tomorrow/weekend) + `FreeWindowCard` (friends ranked by overlap then recency). Empty state CTA opens `OpenInviteSheet`.
2. **4.2** Replace availability density grid with `AvailabilityPills` (open-window pills grouped by day, month default). Power-user opt-in to old grid.
3. **4.3** State-aware primary CTA on dashboard updated for new primitives (open-invite + free-weekend).
4. **4.4** Context-rich `/plan-invite` landing page for non-user arrivals.

## Phase 5 · Week 5+ — Native widget & final polish (PARALLEL)
3 tasks, native-iOS dependency, 2–3 weeks if iOS work begins.

1. **5.1** iOS Home Screen widget (epic, not single Lovable turn): iOS skeleton + WidgetKit, new `widget-state` edge function, small/medium widget designs, post-aha install prompt.
2. **5.2** Default sharing window: 3 months instead of 1 week.
3. **5.3** Coral budget audit — reserve accent for real moments.

## Backend summary (7 touches across the plan)

1. Relax profile NOT NULL constraints (2.1).
2. Add `phone` + `invitee_name` to `plan_invites` (3.5).
3. `send-plan-invite-sms` edge function (3.5).
4. `open_invites` + `open_invite_responses` tables + RLS (3.1).
5. `on-open-invite` edge function with 50-push cap (3.3).
6. `notify-inviter` edge function (2.4).
7. Layover filter in `calendar-sync-worker` (1.5.3).

Dropped from v1: `repeat_attendees` table and calendar-sync-worker attendee extraction (privacy surface too heavy; open-invite primitive replaces growth value).

## Sequencing at a glance

```text
Week 1     | 1.1  1.2  1.3  1.4  1.5  1.6
Week 1–2   | 1.5.1  1.5.2  1.5.3            (parallel w/ Phase 1 tail)
Week 2     | 2.1  2.2  2.3  2.4  2.5
Week 3     | 3.1  3.2  3.3  3.4  3.5  3.6
Week 4     | 4.1  4.2  4.3  4.4
Week 5+    | 5.1  5.2  5.3                  (parallel; 5.1 = iOS epic)
```

## Execution rules

- One sub-task = one Lovable prompt with concrete file paths and acceptance criteria (as authored in the doc).
- Respect sequence: later tasks assume earlier ones have landed (e.g. 4.1 empty-state CTA depends on 3.2 `OpenInviteSheet`; 2.2 wizard depends on 2.1 schema relax; Phase 2 step 2 quality depends on 1.5.1 Apple/Nylas fix).
- Ship behind feature flags where called out (3.5 SMS).
- Broadcast etiquette guardrails (3.3): cap notifications, default audience to pods, silent expiry.

