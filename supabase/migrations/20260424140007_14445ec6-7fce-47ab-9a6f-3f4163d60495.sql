-- Make trip merging non-destructive.
--
-- Previously merge_overlapping_trips() ran on every Trips page visit and
-- silently DELETED one row whenever two trips for the same user had
-- overlapping/touching dates AND fuzzy-matching city names. This caused
-- legitimate trips (e.g. Carolina Beach) to disappear without warning when
-- a buggy/auto-created trip (e.g. an erroneous NYC return Jul 7-13) collided
-- with them.
--
-- New behavior:
--   1. merge_overlapping_trips() becomes a no-op shim that returns 0. We keep
--      the function so existing client code (Trips.tsx) keeps compiling.
--   2. get_conflicting_trips() is broadened to ALSO surface same-or-similar
--      city overlaps (which the merger used to swallow). The user now sees
--      every overlap in the existing TripConflictDialog and explicitly picks
--      what to keep -- no silent deletions.

CREATE OR REPLACE FUNCTION public.merge_overlapping_trips(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-merge disabled: deletions must go through the conflict dialog so the
  -- user can choose which trip to keep. See get_conflicting_trips().
  RETURN 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_conflicting_trips(p_user_id uuid)
RETURNS TABLE(
  trip_a_id uuid, trip_a_location text, trip_a_start date, trip_a_end date,
  trip_b_id uuid, trip_b_location text, trip_b_start date, trip_b_end date
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    a.id, a.location, a.start_date, a.end_date,
    b.id, b.location, b.start_date, b.end_date
  FROM public.trips a
  JOIN public.trips b
    ON a.user_id = b.user_id
   AND a.id < b.id
   -- Include touching ranges (+/- 1 day) so cases the old merger would have
   -- handled silently still surface to the user.
   AND a.start_date <= b.end_date + 1
   AND a.end_date   >= b.start_date - 1
  WHERE a.user_id = p_user_id
    AND a.end_date >= CURRENT_DATE
    AND b.end_date >= CURRENT_DATE
  ORDER BY a.start_date;
$function$;