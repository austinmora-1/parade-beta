-- Fix: Drop the security definer view and use a different approach
-- The view with auth.uid() becomes SECURITY DEFINER which is problematic
DROP VIEW IF EXISTS public.incoming_friendships;

-- Instead, we'll handle email protection at the RLS policy level
-- The friend_user_id can see friendships but we need to handle email access in application code