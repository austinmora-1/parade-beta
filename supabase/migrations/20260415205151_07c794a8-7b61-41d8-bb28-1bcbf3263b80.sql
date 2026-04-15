-- Fix existing rows that violate duration range
UPDATE public.plans SET duration = 15 WHERE duration < 15;
UPDATE public.plans SET duration = 1440 WHERE duration > 1440;

-- Now add constraints
ALTER TABLE public.plans
  ADD CONSTRAINT chk_plans_title_length CHECK (char_length(title) <= 200),
  ADD CONSTRAINT chk_plans_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000),
  ADD CONSTRAINT chk_plans_duration_range CHECK (duration >= 15 AND duration <= 1440);

ALTER TABLE public.friendships
  ADD CONSTRAINT chk_friendships_name_length CHECK (char_length(friend_name) <= 100);