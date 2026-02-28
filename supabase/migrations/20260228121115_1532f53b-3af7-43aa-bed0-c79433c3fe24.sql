-- Fix infinite recursion: replace the SELECT policy on vibe_sends that references vibe_send_recipients
-- with a security definer function that bypasses RLS

CREATE OR REPLACE FUNCTION public.check_vibe_recipient(p_vibe_send_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vibe_send_recipients
    WHERE vibe_send_id = p_vibe_send_id
    AND recipient_id = auth.uid()
  );
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view vibes sent to them" ON public.vibe_sends;

-- Recreate using security definer function to avoid recursion
CREATE POLICY "Users can view vibes sent to them"
ON public.vibe_sends
FOR SELECT
USING (public.check_vibe_recipient(id));

-- Also fix the vibe_send_recipients policies that reference vibe_sends
CREATE OR REPLACE FUNCTION public.check_vibe_sender(p_vibe_send_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vibe_sends
    WHERE id = p_vibe_send_id
    AND sender_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Senders can view recipients of their vibes" ON public.vibe_send_recipients;
CREATE POLICY "Senders can view recipients of their vibes"
ON public.vibe_send_recipients
FOR SELECT
USING (public.check_vibe_sender(vibe_send_id));

DROP POLICY IF EXISTS "Senders can insert recipients" ON public.vibe_send_recipients;
CREATE POLICY "Senders can insert recipients"
ON public.vibe_send_recipients
FOR INSERT
WITH CHECK (public.check_vibe_sender(vibe_send_id));