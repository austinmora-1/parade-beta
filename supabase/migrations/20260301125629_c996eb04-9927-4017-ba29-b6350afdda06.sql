
-- Add dismissed_at column for soft-delete of dismissed vibes
ALTER TABLE public.vibe_send_recipients
ADD COLUMN dismissed_at timestamp with time zone DEFAULT NULL;

-- Update the delete policy to instead allow updates for dismissal
-- Keep the existing delete policy for now but the app will use soft-delete
