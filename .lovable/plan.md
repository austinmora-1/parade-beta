
## UX Redesign Plan — Remaining Work Audit

Here's the status of every task in `.lovable/plan.md`, based on what's landed in the codebase so far.

### Phase 1 · Foundations & quick wins — ✅ Complete
- 1.1 Landing rebuild — done
- 1.2 Defer push + dark mode prompts — done
- 1.3 Default light theme — done
- 1.4 Time-first GuidedPlanSheet — done
- 1.5 Retire CreatePlanDialog as creation path — done
- 1.6 Voice pass on toasts/empty states — done

### Phase 1.5 · Onboarding stickiness — ✅ Complete
- 1.5.1 Apple Calendar via Nylas — done
- 1.5.2 Calendar import visual differentiation — done (just polished)
- 1.5.3 Layover-as-trip filter — done

### Phase 2 · Onboarding rebuild — ✅ Complete
- 2.1 Relax profile NOT NULL — done (no migration needed; already nullable)
- 2.2 4-step OnboardingWizard — done
- 2.3 "First window" aha card — done
- 2.4 Invite-to-unlock + notify-inviter — done
- 2.5 Gate EllyWalkthrough to empty dashboards — done

### Phase 3 · Open-invite primitive + trip/visit split — ✅ Complete
- 3.1 open_invites schema + RLS — done
- 3.2 OpenInviteSheet + useOpenInvites — done
- 3.3 on-open-invite edge function — done
- 3.4 Split GuidedTripSheet → TripSheet + VisitSheet (+ 5 bug fixes) — done
- 3.5 Plan-first SMS invites + push routing — done
- 3.6 UnifiedShareSheet — done

### Phase 4 · Free-weekend surface & polish — ⏳ Not started
- **4.1** Free-weekend dashboard surface: `useOpenWindows` hook + `FreeWindowCard` (4+ hr blocks today/tomorrow/weekend, friends ranked by overlap then recency, empty state opens OpenInviteSheet)
- **4.2** Replace availability density grid with `AvailabilityPills` (open-window pills grouped by day, month default; opt-in to old grid for power users)
- **4.3** State-aware primary CTA on dashboard for new primitives (open-invite + free-weekend)
- **4.4** Context-rich `/plan-invite` landing page for non-user arrivals

### Phase 5 · Native widget & final polish — ✅ Complete (Lovable scope)
- **5.1** iOS Home Screen widget — out of scope for Lovable (native iOS epic)
- **5.2** Default sharing window: 3 months instead of 1 week — done
- **5.3** Coral budget audit — done (avatar fallbacks, passive count badges, idle stat tiles toned to muted; coral reserved for active CTAs, selected states, and live moments)

### Recommended sequence

1. **4.1** Free-weekend surface (highest user-value, depends on already-shipped OpenInviteSheet)
2. **4.3** State-aware dashboard CTA (small, complements 4.1)
3. **4.4** /plan-invite landing page (conversion lift for invite traffic)
4. **4.2** AvailabilityPills (bigger refactor; ship behind opt-out)
5. **5.2** Default 3-month sharing window (one-line config change)
6. **5.3** Coral budget audit (visual sweep across components)

5.1 (native iOS widget) is outside what Lovable can build — flagging for the native team when ready.

### What's left at a glance

```text
Phase 4: 4 tasks (4.1, 4.2, 4.3, 4.4)
Phase 5: 2 tasks shippable in Lovable (5.2, 5.3) + 1 native (5.1)
Total remaining: 6 Lovable tasks
```

Reply with which task to start (or "proceed" to begin with **4.1 Free-weekend surface**).
