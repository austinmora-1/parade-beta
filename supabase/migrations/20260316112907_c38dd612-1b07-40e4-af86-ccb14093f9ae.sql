CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_avail_start date := (date_trunc('week', CURRENT_DATE::timestamp, 'mon') - interval '1 day')::date;
  v_avail_end   date := (v_avail_start + interval '30 days')::date;
  v_result      json;
BEGIN
  WITH
  own_plans AS (
    SELECT
      p.id, p.user_id, p.title, p.activity, p.date, p.time_slot,
      p.duration, p.start_time, p.end_time, p.location, p.notes,
      p.status, p.feed_visibility, p.source, p.source_timezone,
      p.end_date, p.recurring_plan_id, p.created_at
    FROM public.plans p
    WHERE p.user_id = p_user_id
    ORDER BY p.date ASC
    LIMIT 200
  ),
  participated_plan_ids AS (
    SELECT pp.plan_id
    FROM public.plan_participants pp
    WHERE pp.friend_id = p_user_id
  ),
  participated_plans AS (
    SELECT
      p.id, p.user_id, p.title, p.activity, p.date, p.time_slot,
      p.duration, p.start_time, p.end_time, p.location, p.notes,
      p.status, p.feed_visibility, p.source, p.source_timezone,
      p.end_date, p.recurring_plan_id, p.created_at
    FROM public.plans p
    INNER JOIN participated_plan_ids pid ON pid.plan_id = p.id
    WHERE p.user_id <> p_user_id
    ORDER BY p.date ASC
    LIMIT 200
  ),
  all_plan_ids AS (
    SELECT id FROM own_plans
    UNION
    SELECT id FROM participated_plans
  ),
  plan_participants_data AS (
    SELECT pp.plan_id, pp.friend_id, pp.status, pp.role, pp.responded_at
    FROM public.plan_participants pp
    WHERE pp.plan_id IN (SELECT id FROM all_plan_ids)
  ),
  participant_user_ids AS (
    SELECT DISTINCT pp.friend_id AS uid FROM plan_participants_data pp
    UNION
    SELECT DISTINCT pp2.user_id AS uid FROM participated_plans pp2
  ),
  participant_profiles AS (
    SELECT pr.user_id, pr.display_name, pr.avatar_url
    FROM public.profiles pr
    WHERE pr.user_id IN (SELECT uid FROM participant_user_ids)
      AND pr.user_id <> p_user_id
  ),
  outgoing_friendships AS (
    SELECT
      f.id, f.user_id, f.friend_user_id, f.friend_name, f.friend_email,
      f.status, f.is_pod_member, f.created_at, f.updated_at
    FROM public.friendships f
    WHERE f.user_id = p_user_id
  ),
  outgoing_friend_user_ids AS (
    SELECT DISTINCT f.friend_user_id AS uid
    FROM outgoing_friendships f
    WHERE f.friend_user_id IS NOT NULL
  ),
  outgoing_friend_profiles AS (
    SELECT pr.user_id, pr.avatar_url
    FROM public.profiles pr
    WHERE pr.user_id IN (SELECT uid FROM outgoing_friend_user_ids)
  ),
  incoming_friendships AS (
    SELECT f.id, f.user_id, f.friend_user_id, f.friend_name, f.status,
           f.created_at, f.updated_at
    FROM public.friendships f
    WHERE f.friend_user_id = p_user_id
  ),
  incoming_friend_user_ids AS (
    SELECT DISTINCT f.user_id AS uid FROM incoming_friendships f
  ),
  incoming_friend_profiles AS (
    SELECT pr.user_id, pr.display_name, pr.avatar_url
    FROM public.profiles pr
    WHERE pr.user_id IN (SELECT uid FROM incoming_friend_user_ids)
  ),
  avail_data AS (
    SELECT
      a.date, a.early_morning, a.late_morning, a.early_afternoon,
      a.late_afternoon, a.evening, a.late_night,
      a.location_status, a.trip_location, a.vibe
    FROM public.availability a
    WHERE a.user_id = p_user_id
      AND a.date >= v_avail_start
      AND a.date <= v_avail_end
  ),
  caller_profile AS (
    SELECT
      pr.current_vibe, pr.location_status, pr.custom_vibe_tags,
      pr.vibe_gif_url, pr.default_work_days, pr.default_work_start_hour,
      pr.default_work_end_hour, pr.default_availability_status,
      pr.default_vibes, pr.home_address, pr.timezone
    FROM public.profiles pr
    WHERE pr.user_id = p_user_id
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
$$;