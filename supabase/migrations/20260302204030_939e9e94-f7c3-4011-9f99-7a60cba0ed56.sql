
-- Allow plan participants to also create invites (not just owners)
CREATE POLICY "Plan participants can create invites"
ON public.plan_invites
FOR INSERT
WITH CHECK (
  auth.uid() = invited_by
  AND (
    EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_invites.plan_id AND plans.user_id = auth.uid())
    OR plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
  )
);

-- Allow participants to view invites they created
CREATE POLICY "Inviters can view their own invites"
ON public.plan_invites
FOR SELECT
USING (auth.uid() = invited_by);
