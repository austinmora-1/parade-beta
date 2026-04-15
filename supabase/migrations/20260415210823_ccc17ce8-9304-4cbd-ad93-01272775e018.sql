
-- Fix: The friend_profiles view needs security_invoker = true to avoid the security definer warning
-- But then we need the friend SELECT policy back on profiles for the view to work
-- So we re-add the friend policy and rely on the view to strip phone_number

-- Re-add the friend SELECT policy (needed for security_invoker view to work)
CREATE POLICY "Authenticated users can view friend profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.friendships
    WHERE friendships.user_id = auth.uid()
      AND friendships.friend_user_id = profiles.user_id
      AND friendships.status = 'connected'
  )
);

-- Recreate the view with security_invoker = true
CREATE OR REPLACE VIEW public.friend_profiles
WITH (security_invoker = true) AS
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
FROM public.profiles p;
