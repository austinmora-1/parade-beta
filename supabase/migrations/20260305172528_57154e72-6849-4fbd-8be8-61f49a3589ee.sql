-- Live location sharing table
CREATE TABLE public.live_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '8 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

-- Users can manage their own location
CREATE POLICY "Users can manage own location" ON public.live_locations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Friends can view live locations
CREATE POLICY "Friends can view live locations" ON public.live_locations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.user_id = auth.uid()
        AND friendships.friend_user_id = live_locations.user_id
        AND friendships.status = 'connected'
    )
    AND expires_at > now()
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_locations;