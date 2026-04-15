-- Update the cursor-based overload to use profile_cache for read-heavy lookups
CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id uuid, p_plan_cursor timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_avail_start date := (CURRENT_DATE - interval '7 days')::date;
  v_avail_end   date := (CURRENT_DATE + interval '35 days')::date;
  v_plan_start  date := (CURRENT_DATE - interval '14 days')::date;
  v_plan_limit  int := 200;
  v_result      json;
BEGIN
  WITH
  own_plans AS (
    SELECT p.id, p.user_id, p.title, p.activity, p.date, p.time_slot,
      p.duration, p.start_time, p.end_time, p.location, p.notes,
      p.status, p.feed_visibility, p.source, p.source_timezone,
      p.end_date, p.recurring_plan_id, p.created_at
    FROM public.plans p
    WHERE p.user_id = p_user_id
      AND p.date >= v_plan_start
      AND (p_plan_cursor IS NULL OR p.created_at < p_plan_cursor)
    ORDER BY p.date ASC
    LIMIT v_plan_limit
  ),
  participated_plan_ids AS (
    SELECT pp.plan_id FROM public.plan_participants pp WHERE pp.friend_id = p_user_id
  ),
  participated_plans AS (
    SELECT p.id, p.user_id, p.title, p.activity, p.date, p.time_slot,
      p.duration, p.start_time, p.end_time, p.location, p.notes,
      p.status, p.feed_visibility, p.source, p.source_timezone,
      p.end_date, p.recurring_plan_id, p.created_at
    FROM public.plans p INNER JOIN participated_plan_ids pid ON pid.plan_id = p.id
    WHERE p.user_id <> p_user_id
      AND p.date >= v_plan_start
      AND (p_plan_cursor IS NULL OR p.created_at < p_plan_cursor)
    ORDER BY p.date ASC
    LIMIT v_plan_limit
  ),
  all_plan_ids AS (
    SELECT id FROM own_plans UNION SELECT id FROM participated_plans
  ),
  plan_participants_data AS (
    SELECT pp.plan_id, pp.friend_id, pp.status, pp.role, pp.responded_at
    FROM public.plan_participants pp WHERE pp.plan_id IN (SELECT id FROM all_plan_ids)
  ),
  participant_user_ids AS (
    SELECT DISTINCT pp.friend_id AS uid FROM plan_participants_data pp
    UNION SELECT DISTINCT pp2.user_id AS uid FROM participated_plans pp2
  ),
  participant_profiles AS (
    SELECT pr.user_id, pr.display_name, pr.avatar_url
    FROM public.profile_cache pr
    WHERE pr.user_id IN (SELECT uid FROM participant_user_ids) AND pr.user_id <> p_user_id
  ),
  outgoing_friendships AS (
    SELECT f.id, f.user_id, f.friend_user_id, f.friend_name, f.friend_email,
      f.status, f.is_pod_member, f.created_at, f.updated_at
    FROM public.friendships f WHERE f.user_id = p_user_id
  ),
  outgoing_friend_user_ids AS (
    SELECT DISTINCT f.friend_user_id AS uid FROM outgoing_friendships f WHERE f.friend_user_id IS NOT NULL
  ),
  outgoing_friend_profiles AS (
    SELECT pr.user_id, pr.avatar_url FROM public.profile_cache pr
    WHERE pr.user_id IN (SELECT uid FROM outgoing_friend_user_ids)
  ),
  incoming_friendships AS (
    SELECT f.id, f.user_id, f.friend_user_id, f.friend_name, f.status, f.created_at, f.updated_at
    FROM public.friendships f WHERE f.friend_user_id = p_user_id
  ),
  incoming_friend_user_ids AS (
    SELECT DISTINCT f.user_id AS uid FROM incoming_friendships f
  ),
  incoming_friend_profiles AS (
    SELECT pr.user_id, pr.display_name, pr.avatar_url FROM public.profile_cache pr
    WHERE pr.user_id IN (SELECT uid FROM incoming_friend_user_ids)
  ),
  avail_data AS (
    SELECT a.date, a.early_morning, a.late_morning, a.early_afternoon,
      a.late_afternoon, a.evening, a.late_night,
      a.location_status, a.trip_location, a.vibe,
      a.slot_location_early_morning, a.slot_location_late_morning,
      a.slot_location_early_afternoon, a.slot_location_late_afternoon,
      a.slot_location_evening, a.slot_location_late_night
    FROM public.availability a
    WHERE a.user_id = p_user_id AND a.date >= v_avail_start AND a.date <= v_avail_end
  ),
  caller_profile AS (
    SELECT pr.current_vibe, pr.location_status, pr.custom_vibe_tags,
      pr.vibe_gif_url, pr.default_work_days, pr.default_work_start_hour,
      pr.default_work_end_hour, pr.default_availability_status,
      pr.default_vibes, pr.home_address, pr.timezone
    FROM public.profiles pr WHERE pr.user_id = p_user_id
  ),
  has_more AS (
    SELECT EXISTS (
      SELECT 1 FROM public.plans p
      WHERE (p.user_id = p_user_id OR p.id IN (SELECT plan_id FROM participated_plan_ids))
        AND p.date >= v_plan_start
        AND p.created_at < COALESCE(
          (SELECT MIN(created_at) FROM (SELECT created_at FROM own_plans UNION ALL SELECT created_at FROM participated_plans) sub),
          now()
        )
    ) AS val
  )
  SELECT json_build_object(
    'own_plans',               COALESCE((SELECT json_agg(row_to_json(op)) FROM own_plans op), '[]'::json),
    'participated_plans',      COALESCE((SELECT json_agg(row_to_json(pp)) FROM participated_plans pp), '[]'::json),
    'plan_participants',       COALESCE((SELECT json_agg(row_to_json(pd)) FROM plan_participants_data pd), '[]'::json),
    'participant_profiles',    COALESCE((SELECT json_agg(row_to_json(prof)) FROM participant_profiles prof), '[]'::json),
    'outgoing_friendships',    COALESCE((SELECT json_agg(row_to_json(of2)) FROM outgoing_friendships of2), '[]'::json),
    'outgoing_friend_profiles',COALESCE((SELECT json_agg(row_to_json(ofp)) FROM outgoing_friend_profiles ofp), '[]'::json),
    'incoming_friendships',    COALESCE((SELECT json_agg(row_to_json(inf)) FROM incoming_friendships inf), '[]'::json),
    'incoming_friend_profiles',COALESCE((SELECT json_agg(row_to_json(ifp)) FROM incoming_friend_profiles ifp), '[]'::json),
    'availability',            COALESCE((SELECT json_agg(row_to_json(av)) FROM avail_data av), '[]'::json),
    'profile',                 (SELECT row_to_json(cp) FROM caller_profile cp),
    'has_more_plans',          (SELECT val FROM has_more)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

-- Also update the single-arg overload
CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_avail_start date := (CURRENT_DATE - interval '7 days')::date;
  v_avail_end   date := (CURRENT_DATE + interval '35 days')::date;
  v_plan_start  date := (CURRENT_DATE - interval '14 days')::date;
  v_result      json;
BEGIN
  WITH
  own_plans AS (
    SELECT p.id, p.user_id, p.title, p.activity, p.date, p.time_slot,
      p.duration, p.start_time, p.end_time, p.location, p.notes,
      p.status, p.feed_visibility, p.source, p.source_timezone,
      p.end_date, p.recurring_plan_id, p.created_at
    FROM public.plans p WHERE p.user_id = p_user_id AND p.date >= v_plan_start ORDER BY p.date ASC LIMIT 200
  ),
  participated_plan_ids AS (
    SELECT pp.plan_id FROM public.plan_participants pp WHERE pp.friend_id = p_user_id
  ),
  participated_plans AS (
    SELECT p.id, p.user_id, p.title, p.activity, p.date, p.time_slot,
      p.duration, p.start_time, p.end_time, p.location, p.notes,
      p.status, p.feed_visibility, p.source, p.source_timezone,
      p.end_date, p.recurring_plan_id, p.created_at
    FROM public.plans p INNER JOIN participated_plan_ids pid ON pid.plan_id = p.id
    WHERE p.user_id <> p_user_id AND p.date >= v_plan_start ORDER BY p.date ASC LIMIT 200
  ),
  all_plan_ids AS (
    SELECT id FROM own_plans UNION SELECT id FROM participated_plans
  ),
  plan_participants_data AS (
    SELECT pp.plan_id, pp.friend_id, pp.status, pp.role, pp.responded_at
    FROM public.plan_participants pp WHERE pp.plan_id IN (SELECT id FROM all_plan_ids)
  ),
  participant_user_ids AS (
    SELECT DISTINCT pp.friend_id AS uid FROM plan_participants_data pp
    UNION SELECT DISTINCT pp2.user_id AS uid FROM participated_plans pp2
  ),
  participant_profiles AS (
    SELECT pr.user_id, pr.display_name, pr.avatar_url
    FROM public.profile_cache pr
    WHERE pr.user_id IN (SELECT uid FROM participant_user_ids) AND pr.user_id <> p_user_id
  ),
  outgoing_friendships AS (
    SELECT f.id, f.user_id, f.friend_user_id, f.friend_name, f.friend_email,
      f.status, f.is_pod_member, f.created_at, f.updated_at
    FROM public.friendships f WHERE f.user_id = p_user_id
  ),
  outgoing_friend_user_ids AS (
    SELECT DISTINCT f.friend_user_id AS uid FROM outgoing_friendships f WHERE f.friend_user_id IS NOT NULL
  ),
  outgoing_friend_profiles AS (
    SELECT pr.user_id, pr.avatar_url FROM public.profile_cache pr
    WHERE pr.user_id IN (SELECT uid FROM outgoing_friend_user_ids)
  ),
  incoming_friendships AS (
    SELECT f.id, f.user_id, f.friend_user_id, f.friend_name, f.status, f.created_at, f.updated_at
    FROM public.friendships f WHERE f.friend_user_id = p_user_id
  ),
  incoming_friend_user_ids AS (
    SELECT DISTINCT f.user_id AS uid FROM incoming_friendships f
  ),
  incoming_friend_profiles AS (
    SELECT pr.user_id, pr.display_name, pr.avatar_url FROM public.profile_cache pr
    WHERE pr.user_id IN (SELECT uid FROM incoming_friend_user_ids)
  ),
  avail_data AS (
    SELECT a.date, a.early_morning, a.late_morning, a.early_afternoon,
      a.late_afternoon, a.evening, a.late_night,
      a.location_status, a.trip_location, a.vibe,
      a.slot_location_early_morning, a.slot_location_late_morning,
      a.slot_location_early_afternoon, a.slot_location_late_afternoon,
      a.slot_location_evening, a.slot_location_late_night
    FROM public.availability a
    WHERE a.user_id = p_user_id AND a.date >= v_avail_start AND a.date <= v_avail_end
  ),
  caller_profile AS (
    SELECT pr.current_vibe, pr.location_status, pr.custom_vibe_tags,
      pr.vibe_gif_url, pr.default_work_days, pr.default_work_start_hour,
      pr.default_work_end_hour, pr.default_availability_status,
      pr.default_vibes, pr.home_address, pr.timezone
    FROM public.profiles pr WHERE pr.user_id = p_user_id
  )
  SELECT json_build_object(
    'own_plans',               COALESCE((SELECT json_agg(row_to_json(op)) FROM own_plans op), '[]'::json),
    'participated_plans',      COALESCE((SELECT json_agg(row_to_json(pp)) FROM participated_plans pp), '[]'::json),
    'plan_participants',       COALESCE((SELECT json_agg(row_to_json(pd)) FROM plan_participants_data pd), '[]'::json),
    'participant_profiles',    COALESCE((SELECT json_agg(row_to_json(prof)) FROM participant_profiles prof), '[]'::json),
    'outgoing_friendships',    COALESCE((SELECT json_agg(row_to_json(of2)) FROM outgoing_friendships of2), '[]'::json),
    'outgoing_friend_profiles',COALESCE((SELECT json_agg(row_to_json(ofp)) FROM outgoing_friend_profiles ofp), '[]'::json),
    'incoming_friendships',    COALESCE((SELECT json_agg(row_to_json(inf)) FROM incoming_friendships inf), '[]'::json),
    'incoming_friend_profiles',COALESCE((SELECT json_agg(row_to_json(ifp)) FROM incoming_friend_profiles ifp), '[]'::json),
    'availability',            COALESCE((SELECT json_agg(row_to_json(av)) FROM avail_data av), '[]'::json),
    'profile',                 (SELECT row_to_json(cp) FROM caller_profile cp)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;