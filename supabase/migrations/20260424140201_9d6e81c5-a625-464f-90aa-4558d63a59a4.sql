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
   -- True overlap only: at least one shared calendar day.
   -- Trips that merely touch (one ends, the next begins the day after) are NOT conflicts.
   AND a.start_date <= b.end_date
   AND a.end_date   >= b.start_date
  WHERE a.user_id = p_user_id
    AND a.end_date >= CURRENT_DATE
    AND b.end_date >= CURRENT_DATE
  ORDER BY a.start_date;
$function$;