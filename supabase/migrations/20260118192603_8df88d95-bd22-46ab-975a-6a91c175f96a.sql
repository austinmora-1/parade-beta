-- Add column to store allowed friend IDs for hangout requests
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS allowed_hang_request_friend_ids uuid[] DEFAULT '{}';