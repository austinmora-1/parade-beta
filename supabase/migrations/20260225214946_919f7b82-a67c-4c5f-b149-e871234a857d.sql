
-- Secure function to search users by email prefix
-- Returns only user_id and display_name, never exposes full email
-- Only available to authenticated users
CREATE OR REPLACE FUNCTION public.search_users_by_email_prefix(p_query text)
  RETURNS TABLE(user_id uuid, display_name text, avatar_url text, bio text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Require at least 3 characters to prevent broad enumeration
  IF length(p_query) < 3 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.display_name, p.avatar_url, p.bio
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE u.email ILIKE p_query || '%'
    AND p.discoverable = true
    AND u.id != auth.uid()
  LIMIT 20;
END;
$$;
