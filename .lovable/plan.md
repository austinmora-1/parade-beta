
Goal: make the suggested plan dates truly depend on both people’s date-specific city overlap and actual date-specific availability, so Austin only sees dates where both Austin and Dean are in the same city and both are genuinely free.

What I found
- The current wizard is checking both users’ cities in `src/components/plans/GuidedPlanSheet.tsx`, but the logs show Dean’s resolved home city is coming through as `null` for the tested dates:
  - `FRIEND ... home=null → city=`
- That means the current suggestion engine cannot reliably compute Dean’s location for those dates.
- There are also two logic gaps that can still produce misleading suggestions even after location is fixed:
  1. Missing friend availability rows are treated as fully free instead of using profile default schedule/work hours.
  2. The wizard only checks `plans.user_id in allUserIds`, so it can miss times where a friend is busy because they are a participant on someone else’s plan.

Implementation plan

1. Centralize date resolution for each participant
- In `GuidedPlanSheet.tsx`, replace the inline per-loop logic with small helpers:
  - resolve location for a user on a given date:
    availability row → trips row → profile home base
  - resolve availability for a user on a given date:
    explicit availability row → default schedule from profile
  - resolve busy slots for a user on a given date:
    own plans + participated plans
- This will ensure Austin and Dean are evaluated with the exact same rules.

2. Fetch the full profile data needed for both people
- Expand the friend profile query so it includes:
  - `home_address`
  - `default_work_days`
  - `default_work_start_hour`
  - `default_work_end_hour`
  - `default_availability_status`
- Also fetch the current user profile defaults if needed instead of relying only on store state.
- Add a guard so if a friend’s home base is missing and they have no trip/availability location for a date, that date cannot be suggested.

3. Apply default availability logic for missing rows
- Reuse the same work-hour/default-availability behavior already used elsewhere in the app.
- For dates with no explicit availability row:
  - derive whether each slot is free from the user’s default availability status and work schedule
- This prevents the current “missing row = free” behavior from creating false positives.

4. Include participated plans in busy-time filtering
- Update the suggestion query logic so a person is considered busy if they:
  - own a plan on that date/slot, or
  - are listed in `plan_participants` for a non-declined/non-cancelled plan on that date/slot
- This ensures we do not suggest Apr 26 / Apr 28 if either Austin or Dean is already committed through an invited/accepted plan.

5. Make co-location the first hard filter
- For each date in the 6-month scan:
  - resolve Austin city for that date
  - resolve Dean city for that date
  - require both cities to be known and matching before evaluating any slot
- Only after city match passes should slot availability be computed.
- Store the matched city on each result so the UI remains transparent.

6. Tighten suggested-slot generation and calendar status
- Use the same resolved data for:
  - top suggested cards
  - swipeable city groups
  - manual calendar picker statuses
- This avoids one part of the wizard saying a date works while another part disagrees.

7. Add targeted debug output, then remove or minimize it
- Add temporary structured logs for one scanned friend/date showing:
  - resolved city source
  - resolved availability source
  - busy-plan source
  - final inclusion/exclusion reason
- After confirming the Austin/Dean case, reduce logs to a minimal debug path or remove them.

8. QA for the Austin/Dean scenario
- Verify the tested case specifically:
  - Austin in Dallas on the relevant weekend
  - Dean only included on dates where Dean also resolves to Dallas
  - Apr 26 / Apr 28 disappear unless both city match and both are free
- Also verify regression cases:
  - same-home-city friends still get suggestions
  - trip-based overlap in a non-home city still appears
  - multiple shared-city windows still group correctly in the swiper

Technical details
- Main file to update: `src/components/plans/GuidedPlanSheet.tsx`
- Likely add small shared helper(s), either:
  - locally in `GuidedPlanSheet.tsx`, or
  - extracted to a reusable utility near `src/lib/locationMatch.ts`
- No backend schema changes are required.
- The most likely root cause for this specific bug is a combination of:
  - Dean’s home address not being available in the current planning fetch path, and/or
  - fallback logic treating missing availability as open availability.
