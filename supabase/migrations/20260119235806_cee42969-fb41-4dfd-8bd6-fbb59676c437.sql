-- Add default availability settings to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS default_work_days text[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
ADD COLUMN IF NOT EXISTS default_work_start_hour numeric DEFAULT 9,
ADD COLUMN IF NOT EXISTS default_work_end_hour numeric DEFAULT 17,
ADD COLUMN IF NOT EXISTS default_availability_status text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS default_vibes text[] DEFAULT '{}';