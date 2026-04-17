

## Plan: Replace vibe polling/race-guard with realtime subscription

### Goal
Eliminate the vibe race condition by making the local store the single writer and Supabase Realtime the single source of remote truth — so the dashboard RPC never overwrites vibe state and changes propagate across devices instantly.

### Strategy
- **Vibe is owned by `useVibeStore`**, not by `loadAllData`.
- The dashboard RPC stops touching vibe entirely (after initial bootstrap).
- Subscribe to the user's own `profiles` row via realtime; remote updates flow only through this channel.
- Remove the `lastLocalMutationAt` 10-second guard and cache-patching workaround — they're no longer needed.

### Changes

**1. `src/stores/vibeStore.ts` — simplify**
- Remove `lastLocalMutationAt`, `LOCAL_MUTATION_GUARD_MS`, `applyRemoteVibe`, and the cache-patching helper.
- Add a `bootstrapVibe(vibe)` action used **only** on first load (when store has never been initialized for this user) — sets initial vibe from cache/RPC.
- Add an `applyRealtimeUpdate(profileRow)` action — accepts the new profile row from realtime payload, constructs a Vibe, sets it directly. Always wins (it IS the latest server state).
- Optimistic updates in `setVibe` / `addCustomVibe` / `removeCustomVibe`: write locally first, then Supabase. On error, revert to snapshot. On success, do nothing — realtime echo will arrive but matches local state, so it's a no-op.
- Track `initialized: boolean` per user so subsequent RPC loads skip vibe.

**2. New hook: `src/hooks/useVibeRealtime.ts`**
- Mounted once at the app level (in `AppLayout` or `AuthProvider`).
- Uses `useRealtimeHub` to subscribe to `profiles` table, `UPDATE` event, filter `user_id=eq.{currentUserId}`.
- On payload, calls `useVibeStore.getState().applyRealtimeUpdate(payload.new)`.

**3. `src/stores/plannerStore.ts` — stop overwriting vibe**
- In `loadAllData`, when pushing transformed RPC data:
  - Replace `useVibeStore.getState().applyRemoteVibe(...)` with `useVibeStore.getState().bootstrapVibe(...)` — only sets if not yet initialized.
  - Same for the cache hydration path.
- Cache write (`setCachedDashboard`) stays as-is — no patching needed because vibe in cache is just a bootstrap value; realtime keeps the live store accurate regardless.
- Remove the import of `useVibeStore` for the patching workaround if any was added.

**4. Mount the realtime hook**
- Add `useVibeRealtime()` call in `src/components/layout/AppLayout.tsx` (or wherever auth-gated app shell mounts) so it's active on every authenticated screen.

**5. Cleanup**
- Delete dead `VibeSelector.tsx` (already flagged as unused).
- Remove the `patchVibeInCache` helper from `vibeStore.ts` if no other callers.

### Why this fixes the race
- The RPC response can no longer overwrite a fresh local vibe because `bootstrapVibe` is a one-shot.
- Cross-device updates arrive via realtime within ~100ms — faster and cleaner than waiting for the next RPC poll.
- Optimistic local writes echo back through realtime; since the payload matches local state, `applyRealtimeUpdate` is idempotent.

### Files touched
- `src/stores/vibeStore.ts` — simplify, add bootstrap + realtime apply
- `src/stores/plannerStore.ts` — switch to `bootstrapVibe`, remove guard logic
- `src/hooks/useVibeRealtime.ts` — new file
- `src/components/layout/AppLayout.tsx` — mount hook
- `src/components/dashboard/VibeSelector.tsx` — delete (dead code)

### Verification flow
1. Set vibe → reload → persists.
2. Set vibe on phone, watch laptop dashboard update within ~1s without refresh.
3. Set vibe → pull-to-refresh → persists (RPC bootstrap is skipped).
4. Add custom tag, then GIF → both persist on reload and propagate cross-device.
5. Open two tabs, change vibe in tab A → tab B updates automatically.

