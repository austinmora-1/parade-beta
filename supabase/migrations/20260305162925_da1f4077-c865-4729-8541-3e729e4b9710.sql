
-- Allow plan participants to update non-time plan fields (title, activity, location, notes, feed_visibility)
CREATE POLICY "Participants can update non-time plan fields"
ON public.plans
FOR UPDATE
TO authenticated
USING (
  id IN (SELECT user_participated_plan_ids(auth.uid()))
)
WITH CHECK (
  id IN (SELECT user_participated_plan_ids(auth.uid()))
);
