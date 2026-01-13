-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create policy that only allows users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Create a public view for non-sensitive profile data (for friend lookups, etc.)
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

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;