

## Fix Calendar Sync Worker Deduplication Bugs

### Bug 1: iCal path missing `start_time` and `end_time`

**Problem**: When building plan rows from iCal events (lines 876-882), `start_time` and `end_time` are never set. This breaks Layer 2 content-based dedup because the content key includes `start_time`, causing mismatches with Google-imported plans that do have times. Additionally, when updating existing iCal plans (lines 933-936), `start_time` and `end_time` are not included.

**Fix**:
- In the iCal plan row construction (~line 876), compute and add `start_time` and `end_time` using `formatTimeHHMM()` for non-all-day events
- In the iCal update path (~line 933), include `start_time` and `end_time` in the update fields

### Bug 2: Google sync ignores `manually_edited` flag

**Problem**: The Google sync path only protects plans that have participants (`enrichedPlanIds`). Plans marked `manually_edited: true` (e.g., user changed title, merged plans) but with no participants can still be overwritten or deleted.

**Fix**:
- Add `manually_edited` to the existing plans SELECT query (line 705)
- Add `manually_edited` to the allUserPlans SELECT query (line 712)
- When building the delete list (line 740), also exclude plans where `manually_edited === true`
- When updating existing plans (line 753), also skip if `manually_edited === true`
- Apply the same fix to the iCal path (lines 888, 895, 921, 931)

### Files to edit
- `supabase/functions/calendar-sync-worker/index.ts` — both fixes in this single file

