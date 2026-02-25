-- Allow participants to update their own participation status (e.g. decline)
CREATE POLICY "Participants can update their own status"
ON public.plan_participants
FOR UPDATE
USING (auth.uid() = friend_id)
WITH CHECK (auth.uid() = friend_id);

-- Allow participants to delete their own participation
CREATE POLICY "Participants can remove themselves from plans"
ON public.plan_participants
FOR DELETE
USING (auth.uid() = friend_id);