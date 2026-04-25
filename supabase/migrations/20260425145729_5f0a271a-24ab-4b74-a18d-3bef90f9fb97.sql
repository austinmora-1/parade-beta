ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS close_friend_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];