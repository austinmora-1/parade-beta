
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS social_cap integer,
  ADD COLUMN IF NOT EXISTS preferred_social_days text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS preferred_social_times text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS allow_elly_hangouts boolean DEFAULT true;
