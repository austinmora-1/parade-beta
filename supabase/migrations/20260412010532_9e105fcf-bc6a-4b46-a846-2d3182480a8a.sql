CREATE POLICY "Connected friends can view trips"
ON public.trips
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM friendships
    WHERE friendships.user_id = auth.uid()
      AND friendships.friend_user_id = trips.user_id
      AND friendships.status = 'connected'
  )
);