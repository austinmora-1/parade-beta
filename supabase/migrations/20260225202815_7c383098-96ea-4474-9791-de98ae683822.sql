
-- Table to track proposed changes to shared plans
CREATE TABLE public.plan_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL,
  proposed_date TIMESTAMP WITH TIME ZONE,
  proposed_time_slot TEXT,
  proposed_duration INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Per-participant responses to a change request
CREATE TABLE public.plan_change_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  change_request_id UUID NOT NULL REFERENCES public.plan_change_requests(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL,
  response TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_change_responses ENABLE ROW LEVEL SECURITY;

-- RLS for plan_change_requests
-- Users can view change requests for plans they own or participate in
CREATE POLICY "Users can view change requests for their plans"
  ON public.plan_change_requests FOR SELECT
  USING (
    plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
    OR EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_change_requests.plan_id AND plans.user_id = auth.uid())
  );

-- Plan owners can create change requests
CREATE POLICY "Plan owners can create change requests"
  ON public.plan_change_requests FOR INSERT
  WITH CHECK (
    auth.uid() = proposed_by
    AND EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_change_requests.plan_id AND plans.user_id = auth.uid())
  );

-- Plan owners can update their change requests (e.g. resolve)
CREATE POLICY "Plan owners can update change requests"
  ON public.plan_change_requests FOR UPDATE
  USING (auth.uid() = proposed_by);

-- Plan owners can delete change requests
CREATE POLICY "Plan owners can delete change requests"
  ON public.plan_change_requests FOR DELETE
  USING (auth.uid() = proposed_by);

-- RLS for plan_change_responses
-- Users can view responses for change requests they can see
CREATE POLICY "Users can view change responses"
  ON public.plan_change_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plan_change_requests cr
      WHERE cr.id = plan_change_responses.change_request_id
      AND (
        cr.proposed_by = auth.uid()
        OR cr.plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
      )
    )
  );

-- Participants can update their own response
CREATE POLICY "Participants can respond to change requests"
  ON public.plan_change_responses FOR UPDATE
  USING (auth.uid() = participant_id)
  WITH CHECK (auth.uid() = participant_id);

-- Plan owners can insert responses (when creating the request)
CREATE POLICY "Plan owners can create responses"
  ON public.plan_change_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plan_change_requests cr
      WHERE cr.id = plan_change_responses.change_request_id
      AND cr.proposed_by = auth.uid()
    )
  );

-- Function to apply change when all participants accept
CREATE OR REPLACE FUNCTION public.check_and_apply_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
  v_all_accepted BOOLEAN;
BEGIN
  -- Only trigger when response changes to 'accepted'
  IF NEW.response = 'accepted' THEN
    -- Check if all responses for this request are now 'accepted'
    SELECT NOT EXISTS (
      SELECT 1 FROM plan_change_responses
      WHERE change_request_id = NEW.change_request_id
      AND response != 'accepted'
    ) INTO v_all_accepted;

    IF v_all_accepted THEN
      -- Get the change request details
      SELECT * INTO v_request FROM plan_change_requests WHERE id = NEW.change_request_id;

      -- Apply the changes to the plan
      UPDATE plans SET
        date = COALESCE(v_request.proposed_date, date),
        time_slot = COALESCE(v_request.proposed_time_slot, time_slot),
        duration = COALESCE(v_request.proposed_duration, duration),
        updated_at = now()
      WHERE id = v_request.plan_id;

      -- Mark the change request as accepted
      UPDATE plan_change_requests
      SET status = 'accepted', resolved_at = now()
      WHERE id = NEW.change_request_id;
    END IF;
  ELSIF NEW.response = 'declined' THEN
    -- If any participant declines, mark the whole request as declined
    UPDATE plan_change_requests
    SET status = 'declined', resolved_at = now()
    WHERE id = NEW.change_request_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_plan_change_response
  AFTER UPDATE ON public.plan_change_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_apply_plan_change();
