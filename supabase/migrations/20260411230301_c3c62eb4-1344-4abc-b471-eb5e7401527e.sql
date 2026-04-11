
-- Create trips table
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  available_slots TEXT[] NOT NULL DEFAULT ARRAY['early-morning','late-morning','early-afternoon','late-afternoon','evening','late-night'],
  priority_friend_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Owner policies
CREATE POLICY "Users can view their own trips"
ON public.trips FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trips"
ON public.trips FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
ON public.trips FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips"
ON public.trips FOR DELETE
USING (auth.uid() = user_id);

-- Friends can see trips where they're a priority friend
CREATE POLICY "Priority friends can view trips"
ON public.trips FOR SELECT
TO authenticated
USING (
  auth.uid() = ANY(priority_friend_ids)
  AND EXISTS (
    SELECT 1 FROM public.friendships
    WHERE friendships.user_id = auth.uid()
    AND friendships.friend_user_id = trips.user_id
    AND friendships.status = 'connected'
  )
);

-- Timestamp trigger
CREATE TRIGGER update_trips_updated_at
BEFORE UPDATE ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for user lookups
CREATE INDEX idx_trips_user_id ON public.trips(user_id);
CREATE INDEX idx_trips_dates ON public.trips(user_id, start_date, end_date);
