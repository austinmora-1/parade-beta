CREATE POLICY "Participants can view co-participants"
ON public.plan_participants
FOR SELECT
TO public
USING (
  plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
);