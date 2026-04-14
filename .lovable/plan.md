

# Fix Duplicate Plans from Calendar Sync

## Root Cause
`makeContentKey()` in `calendar-helpers.ts` uses raw `start_time` strings without normalizing the format. Database rows store `HH:MM:SS` (e.g., `16:00:00`) while incoming calendar data uses `HH:MM` (e.g., `16:00`). This causes the content-based dedup lookup to miss matches.

## Fix

### 1. Normalize time format in `makeContentKey` (calendar-helpers.ts)
Strip the seconds component from `startTime` before building the key:
```typescript
export function makeContentKey(normalizedTitle: string, date: string, startTime: string | null): string {
  const d = extractDateOnly(date)
  const t = startTime ? startTime.substring(0, 5) : '' // normalize HH:MM:SS → HH:MM
  // ... rest of function uses `t` instead of `startTime`
}
```

### 2. Clean up existing duplicates (one-time migration)
Write a migration that identifies and deletes duplicate gcal-sourced plans where title, date, and `start_time` (truncated to HH:MM) match, keeping the one with the earliest `created_at`.

### Files Changed
| File | Change |
|------|--------|
| `supabase/functions/_shared/calendar-helpers.ts` | Normalize `startTime` in `makeContentKey` |
| DB migration | Delete existing duplicate plans |

This is a 2-line fix in the helper function plus a cleanup migration.

