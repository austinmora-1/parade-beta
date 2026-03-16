
-- Create plan_comments table
CREATE TABLE public.plan_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: plan owner, participants, and friends who can see the plan
CREATE POLICY "Users can view comments on accessible plans"
  ON public.plan_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_comments.plan_id
      AND (
        p.user_id = auth.uid()
        OR plan_comments.plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
        OR (
          p.feed_visibility != 'private'
          AND EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE f.user_id = auth.uid()
            AND f.friend_user_id = p.user_id
            AND f.status = 'connected'
          )
        )
      )
    )
  );

-- INSERT: same access as SELECT
CREATE POLICY "Users can add comments on accessible plans"
  ON public.plan_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_comments.plan_id
      AND (
        p.user_id = auth.uid()
        OR plan_comments.plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
        OR (
          p.feed_visibility != 'private'
          AND EXISTS (
            SELECT 1 FROM public.friendships f
            WHERE f.user_id = auth.uid()
            AND f.friend_user_id = p.user_id
            AND f.status = 'connected'
          )
        )
      )
    )
  );

-- DELETE: own comments only
CREATE POLICY "Users can delete their own comments"
  ON public.plan_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_comments;
