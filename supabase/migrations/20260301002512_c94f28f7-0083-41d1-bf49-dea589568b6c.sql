
-- Drop the overly permissive share code policy
DROP POLICY IF EXISTS "Anyone can view profiles by share code for hang requests" ON public.profiles;

-- Create a security definer function that safely returns only the fields
-- needed for the share page, looking up by share_code
CREATE OR REPLACE FUNCTION public.get_profile_by_share_code(p_share_code text)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  current_vibe text,
  custom_vibe_tags text[],
  location_status text,
  show_availability boolean,
  show_vibe_status boolean,
  show_location boolean,
  allow_all_hang_requests boolean,
  allowed_hang_request_friend_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url,
    p.current_vibe,
    p.custom_vibe_tags,
    p.location_status,
    p.show_availability,
    p.show_vibe_status,
    p.show_location,
    p.allow_all_hang_requests,
    p.allowed_hang_request_friend_ids
  FROM public.profiles p
  WHERE p.share_code = p_share_code
    AND p.show_availability = true
  LIMIT 1;
$$;
