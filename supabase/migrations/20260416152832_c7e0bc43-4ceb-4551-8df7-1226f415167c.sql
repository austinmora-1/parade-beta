DROP FUNCTION IF EXISTS public.get_display_names_for_users(uuid[]);

CREATE FUNCTION public.get_display_names_for_users(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.avatar_url, p.first_name, p.last_name
  FROM profiles p
  WHERE p.user_id = ANY(p_user_ids);
$$;