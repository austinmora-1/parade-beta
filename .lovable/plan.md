

# Sprint 2 — High Priority Scalability Fixes

## Overview
Five issues that cause performance degradation at 20-50K users. Implementing 2.1–2.3 and 2.5 now; 2.4 deferred.

---

## ✅ Issue 2.1: Add Date Bounds to `get_dashboard_data` RPC (DONE)

- Migration: Added `v_plan_start` (14 days ago) filter to own_plans and participated_plans CTEs
- Client: Increased dashboard cache from 30s to 2min in plannerStore.ts

## ✅ Issue 2.2: Add Rate Limiting to Edge Functions (DONE)

- Created `rate_limit_log` table with RLS (service-role only)
- Created shared `_shared/rate-limiter.ts` utility
- Applied to 6 functions: send-sms-invite (10/hr), send-friend-invite (20/hr), send-hang-request (20/hr), send-plan-invite (30/hr), send-push-notification (50/hr), submit-feedback (10/hr)

## ✅ Issue 2.3: Add Route-Level Code Splitting (DONE)

- Converted 11 eager page imports to `lazy()` in App.tsx
- All pages now code-split; existing `<Suspense>` wrapper handles loading

## ✅ Issue 2.5: Add Structured Logging (DONE)

- Created shared `_shared/logger.ts` utility with structured JSON output
- Available for all edge functions to import

## 🔲 Issue 2.4: Split Monolithic plannerStore.ts (DEFERRED)

- 1,744-line Zustand store needs splitting into profile/friends/availability/plans stores
- High-risk refactor touching 50+ components — needs dedicated sprint
- Recommend doing as a standalone task with careful testing

---

## Completed from Sprint 1
- ✅ Issue 1.1: Removed smart-nudges entirely (dead feature)
- ✅ Issue 1.2: Plan reminders N+1 fix (done previously)
- ✅ Issue 1.3: Realtime hub consolidation (done previously)
- ✅ Issue 1.4: Live location removed entirely (dead feature)
