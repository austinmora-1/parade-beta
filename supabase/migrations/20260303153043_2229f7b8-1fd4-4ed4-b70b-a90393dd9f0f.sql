
CREATE OR REPLACE FUNCTION public.get_vibe_recipient_names(p_vibe_send_id uuid)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow if the caller is the sender or a recipient of this vibe
  IF NOT (
    EXISTS (SELECT 1 FROM vibe_sends WHERE id = p_vibe_send_id AND sender_id = auth.uid())
    OR EXISTS (SELECT 1 FROM vibe_send_recipients WHERE vibe_send_id = p_vibe_send_id AND recipient_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT vsr.recipient_id AS user_id, p.display_name
  FROM vibe_send_recipients vsr
  JOIN profiles p ON p.user_id = vsr.recipient_id
  WHERE vsr.vibe_send_id = p_vibe_send_id;
END;
$$;
