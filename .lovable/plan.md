

# Sprint 3 — Medium Priority Scalability Fixes

## Overview
Four issues targeting query performance, input safety, and caching. Issue 3.5 (migration squash) is skipped — too risky for an automated pass and better done manually. Issue 3.6 (profile visibility) is already resolved — profiles RLS already restricts to own + connected friends.

---

## Issue 3.1: Dedicated Feed RPC

**Problem**: `FeedView.tsx` makes 3-4 sequential Supabase queries with per-row RLS evaluation. At scale this is O(all_plans).

**Changes**:
1. **New migration** — Create `get_feed_plans(p_user_id uuid, p_limit int)` SECURITY DEFINER RPC that pre-joins friendships, plans, participants, and profiles server-side, scoped to last 30 days.
2. **Update `src/components/feed/FeedView.tsx`** — Replace the 4-query waterfall (lines 43-151) with a single `supabase.rpc('get_feed_plans', ...)` call.

---

## Issue 3.2: Add Missing Database Indexes

**Problem**: Hot query patterns lack composite/partial indexes.

**Changes**: Single migration adding 8 indexes:
- `availability(user_id, date, location_status)`
- `plan_participants(friend_id, status)`
- `smart_nudges(user_id, nudge_type, friend_user_id)` partial
- `plans(user_id, date, status)`
- `plans(feed_visibility, date DESC)` partial
- `hang_requests(user_id)` partial (pending only)
- `plan_participants(friend_id)` partial (invited only)
- `friendships(user_id, friend_user_id)` partial (connected only)

Note: skip the `live_locations` index from the original plan — table was dropped.

---

## Issue 3.3: Input Validation with Zod

**Problem**: No client-side validation before DB writes. Vulnerable to oversized payloads and bad data.

**Changes**:
1. **Create `src/lib/validation.ts`** — Zod schemas for Plan (title max 200, notes max 2000, duration 15-1440) and Friendship (name max 100).
2. **Update `src/stores/plannerStore.ts`** — Validate in `addPlan` before inserting.
3. **New migration** — Add CHECK constraints on `plans.title`, `plans.notes`, `plans.duration`, and `friendships.friend_name` lengths. Use validation triggers instead of CHECK for any time-based constraints.

---

## Issue 3.4: Configure QueryClient Defaults

**Problem**: `new QueryClient()` on line 37 of `App.tsx` has zero config — staleTime is 0, causing redundant refetches.

**Changes**: Update to:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
```

---

## Execution Order
1. Issue 3.4 (QueryClient) — 1 line change, instant win
2. Issue 3.2 (Indexes) — migration only, no code changes
3. Issue 3.1 (Feed RPC) — migration + FeedView rewrite
4. Issue 3.3 (Validation) — new lib + store + migration

