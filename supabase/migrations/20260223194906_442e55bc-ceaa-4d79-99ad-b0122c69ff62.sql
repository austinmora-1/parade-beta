
-- Drop the existing SELECT policy for incoming friend requests
DROP POLICY IF EXISTS "Users can view incoming friend requests without email" ON public.friendships;

-- Create a view for incoming friend requests that excludes friend_email
CREATE OR REPLACE VIEW public.friendships_incoming
WITH (security_invoker = on) AS
  SELECT id, user_id, friend_user_id, friend_name, status, created_at, updated_at
  FROM public.friendships;
  -- Excludes friend_email column

-- Add RLS-like restriction: only friend_user_id can see incoming requests via this view
-- The view uses security_invoker, so the base table's RLS applies.
-- We need a SELECT policy on the base table for friend_user_id, but one that
-- prevents reading friend_email. Since we can't do column-level RLS,
-- we'll use the view approach: add a restrictive policy that only allows
-- friend_user_id to read via specific columns by re-adding the policy
-- (the view will be the recommended access path, but we still need base table policy for it to work)

-- Re-add the policy for friend_user_id (needed for the security_invoker view to work)
CREATE POLICY "Users can view incoming friend requests"
ON public.friendships
FOR SELECT
USING (auth.uid() = friend_user_id);
