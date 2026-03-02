
-- Table for participant requests to add friends to a plan
CREATE TABLE public.plan_participant_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  friend_user_id UUID NOT NULL,
  friend_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(plan_id, friend_user_id, status)
);

ALTER TABLE public.plan_participant_requests ENABLE ROW LEVEL SECURITY;

-- Organizer can view all requests for their plans
CREATE POLICY "Organizers can view participant requests"
ON public.plan_participant_requests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM plans WHERE plans.id = plan_participant_requests.plan_id AND plans.user_id = auth.uid()
));

-- Participants can view requests they made
CREATE POLICY "Requesters can view their own requests"
ON public.plan_participant_requests
FOR SELECT
USING (auth.uid() = requested_by);

-- Participants can create requests (must be a participant or organizer)
CREATE POLICY "Plan members can request to add friends"
ON public.plan_participant_requests
FOR INSERT
WITH CHECK (
  auth.uid() = requested_by
  AND (
    EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_participant_requests.plan_id AND plans.user_id = auth.uid())
    OR plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
  )
);

-- Only organizer can update (approve/deny)
CREATE POLICY "Organizers can update participant requests"
ON public.plan_participant_requests
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM plans WHERE plans.id = plan_participant_requests.plan_id AND plans.user_id = auth.uid()
));

-- Requesters can delete their own pending requests
CREATE POLICY "Requesters can delete pending requests"
ON public.plan_participant_requests
FOR DELETE
USING (auth.uid() = requested_by AND status = 'pending');

-- Function to approve a participant request (adds to plan_participants)
CREATE OR REPLACE FUNCTION public.approve_participant_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the request and verify caller is the plan organizer
  SELECT pr.*, p.user_id AS plan_owner_id
  INTO v_request
  FROM plan_participant_requests pr
  JOIN plans p ON p.id = pr.plan_id
  WHERE pr.id = p_request_id AND pr.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already resolved';
  END IF;

  IF v_request.plan_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the plan organizer can approve requests';
  END IF;

  -- Check if already a participant
  IF EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = v_request.plan_id AND friend_id = v_request.friend_user_id) THEN
    RAISE EXCEPTION 'User is already a participant';
  END IF;

  -- Add as participant
  INSERT INTO plan_participants (plan_id, friend_id, status, role)
  VALUES (v_request.plan_id, v_request.friend_user_id, 'accepted', 'participant');

  -- Mark request as approved
  UPDATE plan_participant_requests
  SET status = 'approved', resolved_at = now()
  WHERE id = p_request_id;
END;
$$;
