-- Add custom_activities column to profiles for user-created activities
-- Structure: JSON array of {id, label, icon, vibeType}
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_activities jsonb DEFAULT '[]'::jsonb;