
ALTER TABLE public.open_invites DROP CONSTRAINT IF EXISTS open_invites_audience_type_check;
ALTER TABLE public.open_invites ADD CONSTRAINT open_invites_audience_type_check
  CHECK (audience_type IN ('all_friends', 'pod', 'interest', 'friends'));

DROP POLICY IF EXISTS "Recipients can view open invites targeted at them" ON public.open_invites;
CREATE POLICY "Recipients can view open invites targeted at them"
ON public.open_invites FOR SELECT
TO authenticated
USING (
  status = 'open'
  AND expires_at > now()
  AND (
    (audience_type = 'all_friends' AND EXISTS (
      SELECT 1 FROM public.friendships
      WHERE friendships.user_id = open_invites.user_id
        AND friendships.friend_user_id = auth.uid()
        AND friendships.status = 'connected'
    ))
    OR
    (audience_type = 'pod' AND EXISTS (
      SELECT 1 FROM public.pod_members pm
      JOIN public.pods p ON p.id = pm.pod_id
      WHERE p.user_id = open_invites.user_id
        AND ('pod:' || pm.pod_id::text) = ('pod:' || open_invites.audience_ref)
        AND pm.friend_user_id = auth.uid()
    ))
    OR
    (audience_type = 'interest' AND EXISTS (
      SELECT 1 FROM public.friendships f
      JOIN public.profiles pr ON pr.user_id = auth.uid()
      WHERE f.user_id = open_invites.user_id
        AND f.friend_user_id = auth.uid()
        AND f.status = 'connected'
        AND open_invites.audience_ref = ANY(pr.interests)
    ))
    OR
    (audience_type = 'friends' AND open_invites.audience_ref IS NOT NULL
      AND auth.uid()::text = ANY(string_to_array(open_invites.audience_ref, ','))
      AND EXISTS (
        SELECT 1 FROM public.friendships
        WHERE friendships.user_id = open_invites.user_id
          AND friendships.friend_user_id = auth.uid()
          AND friendships.status = 'connected'
      )
    )
  )
);
