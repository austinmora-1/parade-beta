-- Open invites: broadcasts to friends/pods/interest groups
CREATE TABLE public.open_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  activity TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  time_slot TEXT NOT NULL,
  start_time TIME,
  end_time TIME,
  duration INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  notes TEXT,
  audience_type TEXT NOT NULL CHECK (audience_type IN ('all_friends', 'pod', 'interest')),
  audience_ref TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'expired', 'cancelled')),
  claimed_plan_id UUID,
  notified_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_open_invites_user ON public.open_invites(user_id);
CREATE INDEX idx_open_invites_status ON public.open_invites(status, expires_at);
CREATE INDEX idx_open_invites_audience ON public.open_invites(audience_type, audience_ref);

ALTER TABLE public.open_invites ENABLE ROW LEVEL SECURITY;

-- Sender policies
CREATE POLICY "Users can create their own open invites"
ON public.open_invites FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own open invites"
ON public.open_invites FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own open invites"
ON public.open_invites FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own open invites"
ON public.open_invites FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Recipient view policy: friends, pod members, or interest-matched friends
CREATE POLICY "Recipients can view open invites targeted at them"
ON public.open_invites FOR SELECT
TO authenticated
USING (
  status = 'open'
  AND expires_at > now()
  AND (
    -- All-friends broadcast: any connected friend can see it
    (audience_type = 'all_friends' AND EXISTS (
      SELECT 1 FROM public.friendships
      WHERE friendships.user_id = open_invites.user_id
        AND friendships.friend_user_id = auth.uid()
        AND friendships.status = 'connected'
    ))
    OR
    -- Pod broadcast: pod members of the sender's pod can see it
    (audience_type = 'pod' AND EXISTS (
      SELECT 1 FROM public.pod_members pm
      JOIN public.pods p ON p.id = pm.pod_id
      WHERE p.user_id = open_invites.user_id
        AND ('pod:' || pm.pod_id::text) = ('pod:' || open_invites.audience_ref)
        AND pm.friend_user_id = auth.uid()
    ))
    OR
    -- Interest broadcast: connected friends with the matching interest tag
    (audience_type = 'interest' AND EXISTS (
      SELECT 1 FROM public.friendships f
      JOIN public.profiles pr ON pr.user_id = auth.uid()
      WHERE f.user_id = open_invites.user_id
        AND f.friend_user_id = auth.uid()
        AND f.status = 'connected'
        AND open_invites.audience_ref = ANY(pr.interests)
    ))
  )
);

-- Responses table
CREATE TABLE public.open_invite_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  open_invite_id UUID NOT NULL REFERENCES public.open_invites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  response TEXT NOT NULL CHECK (response IN ('claimed', 'declined', 'viewed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (open_invite_id, user_id)
);

CREATE INDEX idx_open_invite_responses_invite ON public.open_invite_responses(open_invite_id);
CREATE INDEX idx_open_invite_responses_user ON public.open_invite_responses(user_id);

ALTER TABLE public.open_invite_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own response"
ON public.open_invite_responses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own response"
ON public.open_invite_responses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own response"
ON public.open_invite_responses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own response"
ON public.open_invite_responses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Invite owners can view all responses"
ON public.open_invite_responses FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.open_invites
  WHERE open_invites.id = open_invite_responses.open_invite_id
    AND open_invites.user_id = auth.uid()
));

-- Updated_at triggers
CREATE TRIGGER update_open_invites_updated_at
BEFORE UPDATE ON public.open_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_open_invite_responses_updated_at
BEFORE UPDATE ON public.open_invite_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Convert open invite to a plan on first claim
CREATE OR REPLACE FUNCTION public.convert_open_invite_to_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.open_invites%ROWTYPE;
  v_plan_id UUID;
BEGIN
  IF NEW.response <> 'claimed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_invite FROM public.open_invites WHERE id = NEW.open_invite_id FOR UPDATE;

  -- Only convert the first claim
  IF v_invite.status <> 'open' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.plans (
    user_id, title, activity, date, time_slot, start_time, end_time, duration,
    location, notes, status, feed_visibility
  ) VALUES (
    v_invite.user_id, v_invite.title, v_invite.activity, v_invite.date, v_invite.time_slot,
    v_invite.start_time, v_invite.end_time, v_invite.duration,
    v_invite.location, v_invite.notes, 'confirmed', 'friends'
  ) RETURNING id INTO v_plan_id;

  -- Add the claimer as an accepted participant
  INSERT INTO public.plan_participants (plan_id, friend_id, status, role, responded_at)
  VALUES (v_plan_id, NEW.user_id, 'accepted', 'participant', now());

  -- Mark invite as claimed
  UPDATE public.open_invites
  SET status = 'claimed', claimed_plan_id = v_plan_id, updated_at = now()
  WHERE id = NEW.open_invite_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_open_invite_claim
AFTER INSERT ON public.open_invite_responses
FOR EACH ROW
EXECUTE FUNCTION public.convert_open_invite_to_plan();