
-- Allow any plan member to create change responses (not just the proposer)
-- This is needed when participants propose changes and the owner needs a response entry
DROP POLICY IF EXISTS "Plan owners can create responses" ON public.plan_change_responses;

CREATE POLICY "Plan members can create change responses"
ON public.plan_change_responses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM plan_change_requests cr
    WHERE cr.id = plan_change_responses.change_request_id
    AND (
      cr.proposed_by = auth.uid()
      OR cr.plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
      OR EXISTS (SELECT 1 FROM plans WHERE plans.id = cr.plan_id AND plans.user_id = auth.uid())
    )
  )
);

-- Also allow the plan owner to respond (update) to change requests from participants
DROP POLICY IF EXISTS "Participants can respond to change requests" ON public.plan_change_responses;

CREATE POLICY "Plan members can respond to change requests"
ON public.plan_change_responses
FOR UPDATE
USING (auth.uid() = participant_id)
WITH CHECK (auth.uid() = participant_id);
