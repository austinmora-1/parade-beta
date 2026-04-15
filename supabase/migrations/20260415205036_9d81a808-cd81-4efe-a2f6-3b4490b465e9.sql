-- Availability lookups by user + date range
CREATE INDEX IF NOT EXISTS idx_availability_user_date_loc
ON public.availability (user_id, date, location_status);

-- Plan participant lookups by friend
CREATE INDEX IF NOT EXISTS idx_plan_participants_friend_status
ON public.plan_participants (friend_id, status);

-- Smart nudges per user (active only)
CREATE INDEX IF NOT EXISTS idx_smart_nudges_user_active
ON public.smart_nudges (user_id, nudge_type, friend_user_id)
WHERE dismissed_at IS NULL AND acted_on_at IS NULL;

-- Plans by owner + date
CREATE INDEX IF NOT EXISTS idx_plans_user_date_status
ON public.plans (user_id, date, status);

-- Feed queries: non-private plans ordered by date
CREATE INDEX IF NOT EXISTS idx_plans_feed_visibility_date
ON public.plans (feed_visibility, date DESC)
WHERE feed_visibility <> 'private';

-- Pending hang requests per user
CREATE INDEX IF NOT EXISTS idx_hang_requests_user_pending
ON public.hang_requests (user_id)
WHERE status = 'pending';

-- Invited plan participants
CREATE INDEX IF NOT EXISTS idx_plan_participants_friend_invited
ON public.plan_participants (friend_id)
WHERE status = 'invited';

-- Connected friendships lookup
CREATE INDEX IF NOT EXISTS idx_friendships_connected
ON public.friendships (user_id, friend_user_id)
WHERE status = 'connected';