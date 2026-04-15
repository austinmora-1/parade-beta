CREATE OR REPLACE FUNCTION public.get_feed_plans(p_user_id uuid, p_limit int DEFAULT 100)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH connected_friends AS (
    SELECT friend_user_id
    FROM friendships
    WHERE user_id = p_user_id AND status = 'connected'
  ),
  participated_plan_ids AS (
    SELECT plan_id FROM plan_participants WHERE friend_id = p_user_id
  ),
  feed_plans AS (
    SELECT DISTINCT ON (p.id) p.*
    FROM plans p
    WHERE p.date < now()
      AND p.user_id <> p_user_id
      AND (
        (p.feed_visibility <> 'private' AND p.user_id IN (SELECT friend_user_id FROM connected_friends))
        OR p.id IN (SELECT plan_id FROM participated_plan_ids)
      )
    ORDER BY p.id, p.date DESC
    LIMIT p_limit
  ),
  ordered_plans AS (
    SELECT * FROM feed_plans ORDER BY date DESC
  ),
  all_user_ids AS (
    SELECT user_id AS uid FROM ordered_plans
    UNION
    SELECT pp.friend_id FROM plan_participants pp WHERE pp.plan_id IN (SELECT id FROM ordered_plans)
  ),
  profiles_lookup AS (
    SELECT user_id, display_name, avatar_url
    FROM profiles
    WHERE user_id IN (SELECT uid FROM all_user_ids)
  ),
  participants_lookup AS (
    SELECT pp.plan_id, pp.friend_id, pp.status, pp.role
    FROM plan_participants pp
    WHERE pp.plan_id IN (SELECT id FROM ordered_plans)
  )
  SELECT json_build_object(
    'plans', COALESCE((SELECT json_agg(row_to_json(op)) FROM ordered_plans op), '[]'::json),
    'participants', COALESCE((SELECT json_agg(row_to_json(pl)) FROM participants_lookup pl), '[]'::json),
    'profiles', COALESCE((SELECT json_agg(row_to_json(pr)) FROM profiles_lookup pr), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;