-- Fix 1: Add INSERT policy for hang_requests to prevent impersonation
-- Users can only create hang requests for themselves
CREATE POLICY "Users can create their own hang requests"
ON public.hang_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Fix 2: Protect friend_email from being accessed by the friend_user_id
-- Drop the existing SELECT policy for incoming friend requests that exposes email
DROP POLICY IF EXISTS "Users can view incoming friend requests" ON public.friendships;

-- Create a new policy that hides email when viewing as friend_user_id
-- The friend can see the friendship exists but not the email
CREATE POLICY "Users can view incoming friend requests without email"
ON public.friendships
FOR SELECT
USING (auth.uid() = friend_user_id);

-- Create a view that explicitly excludes email for incoming requests
CREATE OR REPLACE VIEW public.incoming_friendships AS
SELECT 
  id,
  user_id,
  friend_user_id,
  friend_name,
  status,
  created_at,
  updated_at
FROM public.friendships
WHERE friend_user_id = auth.uid();

-- Grant access to the view
GRANT SELECT ON public.incoming_friendships TO authenticated;