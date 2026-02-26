
-- Allow participants (not just owners) to create plan change requests
DROP POLICY IF EXISTS "Plan owners can create change requests" ON public.plan_change_requests;

CREATE POLICY "Plan members can create change requests"
ON public.plan_change_requests
FOR INSERT
WITH CHECK (
  auth.uid() = proposed_by
  AND (
    -- Owner of the plan
    EXISTS (
      SELECT 1 FROM plans WHERE plans.id = plan_change_requests.plan_id AND plans.user_id = auth.uid()
    )
    OR
    -- Participant of the plan
    plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
  )
);
