
-- Add feed_visibility column to plans table
-- 'private' = only visible to owner/participants (default)
-- 'friends' = visible to all friends
-- 'pod:<pod_id>' = visible to members of a specific pod
ALTER TABLE public.plans ADD COLUMN feed_visibility text NOT NULL DEFAULT 'private';

-- Create index for efficient feed queries
CREATE INDEX idx_plans_feed_visibility ON public.plans(feed_visibility) WHERE feed_visibility != 'private';

-- RLS policy: Allow friends to view plans with feed_visibility = 'friends'
-- (existing policies already allow own + participated plans)
CREATE POLICY "Friends can view public plans"
  ON public.plans FOR SELECT
  USING (
    feed_visibility = 'friends'
    AND EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.user_id = (select auth.uid())
        AND friendships.friend_user_id = plans.user_id
        AND friendships.status = 'connected'
    )
  );

-- Allow friends to view plans shared to a pod they're in
CREATE POLICY "Pod members can view pod-shared plans"
  ON public.plans FOR SELECT
  USING (
    feed_visibility LIKE 'pod:%'
    AND EXISTS (
      SELECT 1 FROM pod_members pm
      JOIN pods p ON p.id = pm.pod_id
      WHERE pm.friend_user_id = (select auth.uid())
        AND p.user_id = plans.user_id
        AND ('pod:' || pm.pod_id::text) = plans.feed_visibility
    )
  );
