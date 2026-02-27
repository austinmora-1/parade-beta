
-- Performance indexes for scaling to 10k+ users
-- These cover the most frequently hit columns in RLS policies, joins, and queries

-- conversation_participants: used by user_conversation_ids() security definer
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id 
ON public.conversation_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id 
ON public.conversation_participants (conversation_id);

-- plan_participants: used by user_participated_plan_ids() security definer
CREATE INDEX IF NOT EXISTS idx_plan_participants_friend_id 
ON public.plan_participants (friend_id);

CREATE INDEX IF NOT EXISTS idx_plan_participants_plan_id 
ON public.plan_participants (plan_id);

-- chat_messages: queried by conversation_id for message loading
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id 
ON public.chat_messages (conversation_id, created_at DESC);

-- plans: queried by user_id and date range constantly
CREATE INDEX IF NOT EXISTS idx_plans_user_id 
ON public.plans (user_id);

CREATE INDEX IF NOT EXISTS idx_plans_date 
ON public.plans (date);

CREATE INDEX IF NOT EXISTS idx_plans_user_id_date 
ON public.plans (user_id, date);

-- availability: queried by user_id + date
CREATE INDEX IF NOT EXISTS idx_availability_user_id_date 
ON public.availability (user_id, date);

-- friendships: used in RLS policies for friend lookups
CREATE INDEX IF NOT EXISTS idx_friendships_user_id_status 
ON public.friendships (user_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_friend_user_id 
ON public.friendships (friend_user_id);

-- profiles: share_code lookups and user_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_share_code 
ON public.profiles (share_code);

-- hang_requests: share_code lookups
CREATE INDEX IF NOT EXISTS idx_hang_requests_share_code 
ON public.hang_requests (share_code);

CREATE INDEX IF NOT EXISTS idx_hang_requests_user_id_status 
ON public.hang_requests (user_id, status);

-- message_reactions: message_id lookups
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id 
ON public.message_reactions (message_id);

-- plan_change_requests: plan_id lookups
CREATE INDEX IF NOT EXISTS idx_plan_change_requests_plan_id 
ON public.plan_change_requests (plan_id);

-- calendar_connections: user_id + provider lookups
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id_provider 
ON public.calendar_connections (user_id, provider);
