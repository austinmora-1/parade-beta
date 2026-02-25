-- Allow users to see plan_participants entries where they are the participant (friend_id)
CREATE POLICY "Users can view plans they participate in"
ON public.plan_participants
FOR SELECT
USING (auth.uid() = friend_id);

-- Allow users to view plans they participate in (via plan_participants)
CREATE POLICY "Users can view plans they are invited to"
ON public.plans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.plan_participants
    WHERE plan_participants.plan_id = plans.id
    AND plan_participants.friend_id = auth.uid()
  )
);