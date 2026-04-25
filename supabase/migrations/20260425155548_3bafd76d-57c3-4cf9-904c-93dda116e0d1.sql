-- RPC: allow guests (not signed in) to RSVP to a plan invite without creating an account.
-- Marks the invite as 'guest_accepted' and stores their name (if not already set) in placeholder_name.
CREATE OR REPLACE FUNCTION public.rsvp_plan_invite_as_guest(p_token text, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
  v_clean_name TEXT;
BEGIN
  v_clean_name := NULLIF(trim(p_name), '');
  IF v_clean_name IS NULL THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT pi.*, p.id AS pid
  INTO v_invite
  FROM plan_invites pi
  JOIN plans p ON p.id = pi.plan_id
  WHERE pi.invite_token = p_token AND pi.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or already used';
  END IF;

  UPDATE plan_invites
  SET status = 'guest_accepted',
      placeholder_name = COALESCE(NULLIF(trim(placeholder_name), ''), v_clean_name),
      accepted_at = now()
  WHERE id = v_invite.id;

  RETURN v_invite.plan_id;
END;
$function$;

-- Allow callers (anon and authenticated) to execute it
GRANT EXECUTE ON FUNCTION public.rsvp_plan_invite_as_guest(text, text) TO anon, authenticated;