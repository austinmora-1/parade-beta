
-- Function to get display names for user IDs (for incoming friend requests)
-- This is needed because public_profiles only shows discoverable users,
-- but we need to show the sender's name regardless of their discoverability setting.
CREATE OR REPLACE FUNCTION public.get_display_names_for_users(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.user_id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(p_user_ids);
$$;
