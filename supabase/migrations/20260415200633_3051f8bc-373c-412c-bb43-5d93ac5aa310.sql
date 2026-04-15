
-- Create last_hung_out_cache for pre-computed social recency data
CREATE TABLE public.last_hung_out_cache (
  user_id UUID NOT NULL,
  friend_user_id UUID NOT NULL,
  last_plan_date TIMESTAMPTZ NOT NULL,
  last_plan_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_user_id)
);

ALTER TABLE public.last_hung_out_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own cache rows"
  ON public.last_hung_out_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for smart_nudges: speed up filtering active nudges
CREATE INDEX IF NOT EXISTS idx_smart_nudges_active
  ON public.smart_nudges (user_id)
  WHERE dismissed_at IS NULL AND acted_on_at IS NULL;

-- Index for plan_change_responses: speed up participant lookups
CREATE INDEX IF NOT EXISTS idx_plan_change_responses_participant
  ON public.plan_change_responses (participant_id, response);

-- Index for plan_photos: speed up recent photo counts
CREATE INDEX IF NOT EXISTS idx_plan_photos_created_at
  ON public.plan_photos (created_at DESC);
