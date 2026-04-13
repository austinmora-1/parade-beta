

## Fix: Airplane Icon Showing for Home-Based Friends

### Root Cause

In `FriendProfileContent.tsx` (line 425), the `isAway` check uses an OR condition:

```typescript
const isAway = profile.location_status === 'away' || todayAvail?.location_status === 'away';
```

If `profile.location_status` is stale (stuck on `'away'` from a previous trip), the airplane icon displays even when today's availability record correctly says `'home'`. Kristen's profile likely has `location_status = 'away'` left over from a past trip, but her availability for today shows `'home'` (Reno).

### Fix

**File: `src/components/friends/FriendProfileContent.tsx`**

Change the `isAway` logic to prioritize today's availability record over the profile-level field. If today's availability exists, use its `location_status`; only fall back to `profile.location_status` when there's no availability record for today.

```typescript
// Before (line 425):
const isAway = profile.location_status === 'away' || todayAvail?.location_status === 'away';

// After:
const isAway = todayAvail
  ? todayAvail.location_status === 'away'
  : profile.location_status === 'away';
```

This is a single-line change in one file.

