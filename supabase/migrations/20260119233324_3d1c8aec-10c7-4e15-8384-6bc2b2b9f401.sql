-- Add trip_location column to availability table for storing trip destination cities
ALTER TABLE public.availability
ADD COLUMN trip_location text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.availability.trip_location IS 'City/location name when user is away on a trip';