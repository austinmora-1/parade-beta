-- Add settings columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS plan_reminders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS friend_requests_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS plan_invitations_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_availability BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_vibe_status BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS discoverable BOOLEAN DEFAULT true;