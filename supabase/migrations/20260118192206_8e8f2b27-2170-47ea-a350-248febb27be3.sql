-- Add new privacy columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS show_location boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_all_hang_requests boolean DEFAULT true;