
-- Add role column to plan_participants to distinguish regular participants from subscribers
ALTER TABLE public.plan_participants 
ADD COLUMN role text NOT NULL DEFAULT 'participant';

-- Add a comment for documentation
COMMENT ON COLUMN public.plan_participants.role IS 'participant = blocks their time slot, subscriber = view-only visibility';
