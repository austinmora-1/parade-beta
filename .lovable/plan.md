

# Fix Calendar Sync Plan Deduplication

## Problem

Calendar sync is creating duplicate plans because:

1. **iCal recurring events get new UIDs each sync** — Apple Calendar generates different `source_event_id` values for the same recurring event instance across syncs, so the existing dedup-by-event-ID completely misses them
2. **Shared Google Calendar events** — the same event shared across multiple Google calendars has different event IDs, creating duplicates
3. **No database-level protection** — there's no unique constraint, so race conditions between the two-hourly auto-sync and manual syncs can insert duplicates

Real data confirms this: "Power Yoga", "YS Vinyasa", "Authentic knife making" all have duplicate rows for the same user, same date, same time, but different `source_event_id` values.

## Plan

### 1. Add content-based dedup to sync functions

Before inserting new plans, check for existing plans with the **same user_id + date + title + start_time** (regardless of source or source_event_id). If a match exists, skip the insert or update the existing record's `source_event_id` instead.

**Files:** `supabase/functions/google-calendar-sync/index.ts`, `supabase/functions/ical-sync/index.ts`, `supabase/functions/calendar-sync-worker/index.ts`

Changes in each sync function:
- After the existing `existingByEventId` lookup, also fetch all plans for the user in the sync date range (not filtered by source)
- Build a secondary lookup: `Map<"title|date|start_time", plan>` 
- When a plan isn't found by `source_event_id`, check the content-based lookup before inserting
- If content-match found: update that plan's `source_event_id` to link it, skip insert

### 2. Add unique constraint to prevent future duplicates

Add a DB migration with a unique index on `(user_id, source, source_event_id)` to prevent exact-duplicate inserts at the database level. This catches race conditions the app logic misses.

**File:** New SQL migration

```sql
-- First clean up existing exact duplicates (keep the oldest)
DELETE FROM plans p1
USING plans p2
WHERE p1.user_id = p2.user_id
  AND p1.source = p2.source
  AND p1.source_event_id = p2.source_event_id
  AND p1.source IS NOT NULL
  AND p1.source_event_id IS NOT NULL
  AND p1.created_at > p2.created_at;

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS plans_user_source_event_unique 
ON plans (user_id, source, source_event_id) 
WHERE source IS NOT NULL AND source_event_id IS NOT NULL;
```

### 3. Clean up existing content-based duplicates

Add a one-time cleanup migration that removes content-based duplicates (same user + date + title + start_time, different source_event_id), keeping the oldest record.

**File:** New SQL migration

```sql
DELETE FROM plans p1
USING plans p2
WHERE p1.user_id = p2.user_id
  AND p1.date = p2.date
  AND p1.title = p2.title
  AND COALESCE(p1.start_time::text, '') = COALESCE(p2.start_time::text, '')
  AND p1.id != p2.id
  AND p1.created_at > p2.created_at
  AND NOT EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = p1.id);
```

### 4. Expand `normalize_trip_city` with abbreviations and neighborhoods

Add common city abbreviations (NYC, SF, LA, DC, NOLA, ATX) and neighborhood-to-city mappings (Brooklyn → New York City, Hollywood → Los Angeles, etc.) to the existing DB function.

**File:** New SQL migration updating `normalize_trip_city`

### 5. Use upsert with conflict handling in sync inserts

Change the `insert` calls to `upsert` with `onConflict: 'user_id,source,source_event_id'` and `ignoreDuplicates: true` so even if the app-level dedup misses something, the DB constraint prevents duplicates silently.

**Files:** Same three sync edge functions

## Technical Details

- Content-based dedup key: `lower(trim(title)) + date + coalesce(start_time, '')` — this catches iCal recurring events with changing UIDs and cross-calendar shared events
- The unique index is partial (WHERE source IS NOT NULL) so manually created plans without a source aren't affected
- Cleanup migration preserves plans that have participants (enriched plans)
- All three sync codepaths (google-calendar-sync, ical-sync, calendar-sync-worker) get identical fixes
