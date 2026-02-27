
-- Add phone_number column to profiles
ALTER TABLE public.profiles ADD COLUMN phone_number text;

-- Create index for phone number lookups
CREATE INDEX idx_profiles_phone_number ON public.profiles (phone_number) WHERE phone_number IS NOT NULL;

-- Create a secure search function for phone number prefix
CREATE OR REPLACE FUNCTION public.search_users_by_phone_prefix(p_query text)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, bio text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require at least 4 digits to prevent broad enumeration
  IF length(regexp_replace(p_query, '[^0-9]', '', 'g')) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.display_name, p.avatar_url, p.bio
  FROM public.profiles p
  WHERE p.phone_number IS NOT NULL
    AND regexp_replace(p.phone_number, '[^0-9]', '', 'g') LIKE regexp_replace(p_query, '[^0-9]', '', 'g') || '%'
    AND p.discoverable = true
    AND p.user_id != auth.uid()
  LIMIT 20;
END;
$$;
