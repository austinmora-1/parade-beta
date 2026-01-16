-- Add column to store custom vibe tags
ALTER TABLE public.profiles 
ADD COLUMN custom_vibe_tags text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.custom_vibe_tags IS 'Array of custom vibe hashtags set by the user';