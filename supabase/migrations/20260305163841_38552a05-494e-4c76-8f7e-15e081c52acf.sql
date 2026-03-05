
-- Smart nudges table for friendship reminders and social suggestions
CREATE TABLE public.smart_nudges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nudge_type text NOT NULL, -- 'fading_friendship', 'friends_available', 'reconnect'
  friend_user_id uuid, -- the friend this nudge is about (nullable for group nudges)
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb, -- extra data like friend count, days since, etc.
  dismissed_at timestamp with time zone,
  acted_on_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_smart_nudges_user_active ON public.smart_nudges (user_id, created_at DESC) 
  WHERE dismissed_at IS NULL AND acted_on_at IS NULL;

-- RLS
ALTER TABLE public.smart_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own nudges"
  ON public.smart_nudges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own nudges"
  ON public.smart_nudges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own nudges"
  ON public.smart_nudges FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
