

# Sprint 1 — Critical Scalability Fixes

## Overview
Four critical issues that will cause hard failures at 5-50K users. Implementing all four in this pass.

---

## Issue 1.1: Batch-Process Smart Nudges

**Problem**: `smart-nudges` edge function loads ALL profiles, friendships, plans, and participants into memory and builds O(n²) pair maps. Will OOM at ~5-10K users.

**Changes**:
1. **New migration**: Create `last_hung_out_cache` table with composite PK `(user_id, friend_user_id)` and RLS for authenticated read
2. **New edge function** `update-last-hung-out`: Daily cron job that computes shared plan dates in batches of 500 users, upserts into cache
3. **Rewrite `smart-nudges/index.ts`**: Accept `batch_size`/`batch_offset` params, process 500 users at a time, read from cache instead of computing pairs, self-chain for remaining batches

---

## Issue 1.2: Fix Plan Reminders N+1

**Problem**: `plan-reminders/index.ts` makes per-plan queries for participants, profiles, and push subscriptions inside a loop. Thousands of sequential DB roundtrips at scale.

**Changes to `supabase/functions/plan-reminders/index.ts`**:
- After filtering `plansInWindow`, batch-fetch ALL participants, profiles, and push subscriptions in 3 parallel queries
- Build lookup maps (planId→participants, userId→profile, userId→subscriptions)
- Replace inner per-plan queries with map lookups
- Send push notifications in parallel batches of 50 using `Promise.allSettled`
- Batch-delete expired subscriptions at the end

---

## Issue 1.3: Consolidate Realtime Channels

**Problem**: Each user opens 4-6 Supabase Realtime channels. At 5K concurrent users = 25K+ channels, overwhelming Realtime infrastructure.

**Changes**:
1. **New file `src/hooks/useRealtimeHub.ts`**: Singleton channel manager that maintains one shared channel per user, dispatches events to registered handlers by table/event key
2. **Refactor `src/hooks/useNotifications.ts`**: Replace `supabase.channel('notifications-shared')` with `useRealtimeHub` registration
3. **Refactor `src/hooks/useFriendRequestNotifications.ts`**: Replace dedicated channel with `useRealtimeHub`
4. **`src/components/plans/PlanComments.tsx`** and **`PlanPhotos.tsx`**: Convert per-plan realtime channels to 15-second polling intervals (only active on detail pages)
5. **`src/components/dashboard/HangRequests.tsx`**: Convert to `useRealtimeHub` if it has its own channel

---

## Issue 1.4: Fix Live Location Broadcast Storm

**Problem**: `useLiveLocation` listens to ALL `live_locations` changes unfiltered. Every GPS update (every 1-5 seconds) from any user broadcasts to every client. No write throttling.

**Changes to `src/hooks/useLiveLocation.ts`**:
1. Add 30-second throttle on GPS writes via `lastUpdateRef`
2. Replace realtime subscription with 30-second polling interval
3. Scope `fetchFriendLocations` query to connected friend user IDs only (currently fetches all with `.neq('user_id', user.id)`)
4. Remove `supabase.channel('live-locations')` entirely

---

## Technical Notes
- The `last_hung_out_cache` table needs a database migration
- Edge function changes deploy automatically
- The realtime hub is a new shared singleton — careful cleanup on unmount
- No UI changes — all fixes are infrastructure/backend
- Issue 1.2 and 1.4 are lower effort; 1.1 and 1.3 are higher effort

