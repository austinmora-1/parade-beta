
-- Add unique constraint on display_name for username uniqueness
CREATE UNIQUE INDEX idx_profiles_display_name_unique ON public.profiles (lower(display_name)) WHERE display_name IS NOT NULL;

-- Function to check if a username is available (case-insensitive)
CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(display_name) = lower(p_username)
      AND user_id != auth.uid()
  );
$$;
