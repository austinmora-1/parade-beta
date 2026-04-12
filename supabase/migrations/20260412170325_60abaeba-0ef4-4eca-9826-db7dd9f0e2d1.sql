
-- Create trip_participants table for travel companions
CREATE TABLE public.trip_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  friend_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(trip_id, friend_user_id)
);

-- Enable RLS
ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;

-- Trip owners can do everything
CREATE POLICY "Trip owners can manage participants"
ON public.trip_participants
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = trip_participants.trip_id
    AND trips.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = trip_participants.trip_id
    AND trips.user_id = auth.uid()
  )
);

-- Travel companions can view trips they're part of
CREATE POLICY "Participants can view their own participation"
ON public.trip_participants
FOR SELECT
USING (auth.uid() = friend_user_id);

-- Connected friends can see participants on friend trips
CREATE POLICY "Connected friends can view trip participants"
ON public.trip_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    JOIN public.friendships f ON f.user_id = auth.uid() AND f.friend_user_id = t.user_id AND f.status = 'connected'
    WHERE t.id = trip_participants.trip_id
  )
);

-- Index for performance
CREATE INDEX idx_trip_participants_trip_id ON public.trip_participants(trip_id);
CREATE INDEX idx_trip_participants_friend_user_id ON public.trip_participants(friend_user_id);
