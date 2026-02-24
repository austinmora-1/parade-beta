-- Add sender_id column to track who sent the hang request
ALTER TABLE public.hang_requests ADD COLUMN sender_id uuid;

-- Backfill existing requests: we know austin (30279b3f-...) sent all existing ones
-- but we can't be certain, so leave them null for now

-- Add RLS policy so senders can see their outgoing requests
CREATE POLICY "Senders can view their sent hang requests"
  ON public.hang_requests
  FOR SELECT
  USING (auth.uid() = sender_id);
