-- Add optional name column to trips and trip_proposals to distinguish trip name (e.g. 'Bachelorette') from location (city)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.trip_proposals
  ADD COLUMN IF NOT EXISTS name TEXT;