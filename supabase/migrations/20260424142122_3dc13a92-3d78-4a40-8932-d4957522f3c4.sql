
DROP FUNCTION IF EXISTS public.get_conflicting_trips(uuid);

CREATE OR REPLACE FUNCTION public.get_conflicting_trips(p_user_id uuid)
RETURNS TABLE(
  trip_a_id uuid, trip_a_name text, trip_a_location text, trip_a_start date, trip_a_end date,
  trip_a_participant_ids uuid[],
  trip_b_id uuid, trip_b_name text, trip_b_location text, trip_b_start date, trip_b_end date,
  trip_b_participant_ids uuid[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH trip_people AS (
    SELECT t.id AS trip_id, ARRAY(
      SELECT DISTINCT uid FROM (
        SELECT unnest(t.priority_friend_ids) AS uid
        UNION
        SELECT tp.friend_user_id FROM public.trip_participants tp WHERE tp.trip_id = t.id
        UNION
        SELECT tpp.user_id
          FROM public.trip_proposal_participants tpp
         WHERE t.proposal_id IS NOT NULL
           AND tpp.proposal_id = t.proposal_id
           AND tpp.user_id <> t.user_id
      ) s
      WHERE uid IS NOT NULL
    ) AS people
    FROM public.trips t
    WHERE t.user_id = p_user_id
  )
  SELECT
    a.id, a.name, a.location, a.start_date, a.end_date,
    COALESCE(pa.people, '{}'::uuid[]),
    b.id, b.name, b.location, b.start_date, b.end_date,
    COALESCE(pb.people, '{}'::uuid[])
  FROM public.trips a
  JOIN public.trips b
    ON a.user_id = b.user_id
   AND a.id < b.id
   AND a.start_date <= b.end_date
   AND a.end_date   >= b.start_date
  LEFT JOIN trip_people pa ON pa.trip_id = a.id
  LEFT JOIN trip_people pb ON pb.trip_id = b.id
  WHERE a.user_id = p_user_id
    AND a.end_date >= CURRENT_DATE
    AND b.end_date >= CURRENT_DATE
  ORDER BY a.start_date;
$function$;
