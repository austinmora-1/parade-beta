
## Conflict analysis: Performance plan vs. Sprint roadmap

I cross-referenced my proposed Phases 1–3 against the Sprint plan in the attached doc. Short answer: **no conflicts, all complementary.** Details below.

### Sprint plan scope (relevant items)
- **Sprint 1**: smart-nudges batching, plan-reminders N+1 fix, realtime channel cleanup, live-location throttle
- **Sprint 2**: date bounds on `get_dashboard_data`, rate limiter, **lazy imports in App/routes**, **split plannerStore into 4 stores**, structured logging
- **Sprint 3**: `get_feed_plans` RPC, composite indexes, validation, error boundaries
- Sprint 4+: backups, monitoring

### My proposed phases vs. Sprint plan

| My phase | Sprint item | Conflict? | Notes |
|---|---|---|---|
| **1.1** Lazy-load dashboard widgets (`HomeTabs`, `QuickPlanDrop`, `EllyWalkthrough`) | Sprint 2 lazy-import work targets `App.tsx` routes | **None** — complementary | Sprint plan lazies routes; mine lazies in-page widgets. Stack cleanly. |
| **1.2** Vite `manualChunks` (vendor splitting) | Not in Sprint plan | **None** | Pure additive build config. |
| **1.3** Font optimization in `index.html` | Not in Sprint plan | **None** | HTML-only change. |
| **2.1** Extend `get_dashboard_data` RPC (add vibe/proposals/friend-plans) | Sprint 2.1 adds **date bounds** to same RPC | **Mild overlap, no conflict** | Both edit the same RPC. Order matters: do Sprint 2.1 (date bounds) first, then layer my additions on top. Otherwise we'd rewrite the RPC twice. |
| **2.2** Dedupe widget fetches via `lastFetchedAt` gate | Sprint 2 splits plannerStore into 4 stores | **Mild overlap** | If store split lands first, my gate moves into the new sub-stores (e.g., `dashboardStore.lastFetchedAt`). Trivial port. |
| **3.1** Fix Badge ref warning | Not in Sprint plan | **None** | |
| **3.2** Preconnect to Supabase URL | Not in Sprint plan | **None** | |

### Recommended sequencing
To avoid rework on the RPC and store changes:

1. **Now (safe, zero overlap)**: Phase 1.1 + 1.2 + 1.3 + Phase 3 — lazy widgets, chunking, fonts, Badge fix, preconnect.
2. **After Sprint 2.1 (RPC date bounds)**: layer Phase 2.1 additions onto the same RPC in one migration.
3. **After Sprint 2 store split**: port Phase 2.2 dedupe gate into the new dashboard sub-store.

### Bonus: my plan accelerates two Sprint goals
- Phase 2.1 collapses 3 widget fetches into the RPC — directly furthers Sprint 2's "reduce dashboard query waterfall" theme.
- Phase 1.2 chunking helps the lazy-import work in Sprint 2 by ensuring lazy chunks are actually small.

### Decision needed
Pick one:
- **A**: Proceed now with Phase 1 + 3 only (zero conflict, no DB/store changes). Defer Phase 2 until Sprint 2.1 lands.
- **B**: Proceed with all phases now, accepting that the RPC and store-gate code may need a small refactor when Sprint 2 lands.
- **C**: Pause perf work entirely until Sprint 2 is implemented, then do everything together.
