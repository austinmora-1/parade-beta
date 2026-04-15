
-- Add proposal_status to plans
ALTER TABLE public.plans
  ADD COLUMN proposal_status text DEFAULT NULL;

-- Plan proposal options table
CREATE TABLE public.plan_proposal_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  date timestamptz NOT NULL,
  time_slot text NOT NULL,
  start_time time WITHOUT TIME ZONE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_proposal_options ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_plan_proposal_options_plan_id ON public.plan_proposal_options(plan_id);

-- Plan owner can do everything
CREATE POLICY "Plan owners can manage proposal options"
ON public.plan_proposal_options
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.plans WHERE plans.id = plan_proposal_options.plan_id AND plans.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.plans WHERE plans.id = plan_proposal_options.plan_id AND plans.user_id = auth.uid()
));

-- Participants can view options
CREATE POLICY "Participants can view proposal options"
ON public.plan_proposal_options
FOR SELECT
USING (plan_id IN (SELECT user_participated_plan_ids(auth.uid())));

-- Plan proposal votes table
CREATE TABLE public.plan_proposal_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id uuid NOT NULL REFERENCES public.plan_proposal_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(option_id, user_id)
);

ALTER TABLE public.plan_proposal_votes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_plan_proposal_votes_option_id ON public.plan_proposal_votes(option_id);
CREATE INDEX idx_plan_proposal_votes_user_id ON public.plan_proposal_votes(user_id);

-- Plan owners and participants can view all votes for their plans
CREATE POLICY "Plan members can view votes"
ON public.plan_proposal_votes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.plan_proposal_options ppo
  JOIN public.plans p ON p.id = ppo.plan_id
  WHERE ppo.id = plan_proposal_votes.option_id
  AND (p.user_id = auth.uid() OR ppo.plan_id IN (SELECT user_participated_plan_ids(auth.uid())))
));

-- Users can insert their own votes
CREATE POLICY "Users can submit their votes"
ON public.plan_proposal_votes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.plan_proposal_options ppo
    JOIN public.plans p ON p.id = ppo.plan_id
    WHERE ppo.id = plan_proposal_votes.option_id
    AND (p.user_id = auth.uid() OR ppo.plan_id IN (SELECT user_participated_plan_ids(auth.uid())))
  )
);

-- Users can update their own votes
CREATE POLICY "Users can update their votes"
ON public.plan_proposal_votes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete their votes"
ON public.plan_proposal_votes
FOR DELETE
USING (auth.uid() = user_id);
