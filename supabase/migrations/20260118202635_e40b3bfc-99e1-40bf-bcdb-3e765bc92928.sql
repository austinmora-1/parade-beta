-- Drop the overly permissive public profiles policy
DROP POLICY IF EXISTS "Public can view discoverable profiles" ON public.profiles;

-- Create a restrictive policy that only allows public access to specific columns via the view
-- Users can still view their own full profile
-- For public access, we'll use the public_profiles view instead

-- Recreate the public_profiles view with security_invoker to only expose safe fields
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  display_name,
  avatar_url,
  bio,
  discoverable,
  created_at
FROM public.profiles
WHERE discoverable = true;

-- Grant select on the view to authenticated and anon users
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- Add a comment explaining the security design
COMMENT ON VIEW public.public_profiles IS 'Public-safe view of profiles. Only exposes display_name, avatar_url, bio for discoverable users. Does NOT expose share_code, home_address, allowed_hang_request_friend_ids, or other sensitive fields.';