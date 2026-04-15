
-- 1. Create friend_profiles view that excludes phone_number
-- Uses security_invoker = false (default) so it runs as view owner, bypassing profiles RLS
-- The view itself enforces that only connected friends can see data
CREATE OR REPLACE VIEW public.friend_profiles AS
SELECT
  p.user_id,
  p.display_name,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.bio,
  p.home_address,
  p.cover_photo_url,
  p.current_vibe,
  p.custom_vibe_tags,
  p.vibe_gif_url,
  p.location_status,
  p.neighborhood,
  p.interests,
  p.social_goals,
  p.social_cap,
  p.preferred_social_days,
  p.preferred_social_times,
  p.show_availability,
  p.show_vibe_status,
  p.show_location,
  p.allow_all_hang_requests,
  p.allowed_hang_request_friend_ids,
  p.allow_elly_hangouts,
  p.default_work_days,
  p.default_work_start_hour,
  p.default_work_end_hour,
  p.default_availability_status,
  p.default_vibes,
  p.custom_activities,
  p.share_code,
  p.timezone,
  p.discoverable,
  p.onboarding_completed,
  p.walkthrough_completed,
  p.plan_reminders,
  p.friend_requests_notifications,
  p.plan_invitations_notifications,
  p.created_at,
  p.updated_at,
  p.id
FROM public.profiles p
WHERE
  -- Owner can see their own profile
  p.user_id = auth.uid()
  OR
  -- Connected friends can see (excluding phone_number)
  EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.user_id = auth.uid()
      AND f.friend_user_id = p.user_id
      AND f.status = 'connected'
  );

-- 2. Drop the broad friend SELECT policy on profiles table
-- This was exposing ALL columns including phone_number to connected friends
DROP POLICY IF EXISTS "Authenticated users can view friend profiles" ON public.profiles;

-- 3. Drop unauthenticated "Anyone can view" storage policies on private buckets
-- These allowed unauthenticated access to private bucket files
DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view plan photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view vibe media" ON storage.objects;
