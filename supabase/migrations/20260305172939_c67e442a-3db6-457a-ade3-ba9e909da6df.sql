-- Add shared_with column (array of user IDs this location is shared with; null = all friends)
ALTER TABLE public.live_locations ADD COLUMN shared_with uuid[] DEFAULT NULL;

-- Drop and recreate the friend visibility policy to check shared_with
DROP POLICY IF EXISTS "Friends can view live locations" ON public.live_locations;

CREATE POLICY "Friends can view live locations" ON public.live_locations
  FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND (
      -- Shared with all friends (shared_with is null)
      (shared_with IS NULL AND EXISTS (
        SELECT 1 FROM friendships
        WHERE friendships.user_id = auth.uid()
          AND friendships.friend_user_id = live_locations.user_id
          AND friendships.status = 'connected'
      ))
      OR
      -- Shared with specific friends
      (shared_with IS NOT NULL AND auth.uid() = ANY(shared_with))
    )
  );