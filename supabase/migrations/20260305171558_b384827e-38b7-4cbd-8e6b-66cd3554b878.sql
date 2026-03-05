CREATE OR REPLACE FUNCTION public.accept_plan_invite(p_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pi.*, p.user_id AS plan_owner_id
  INTO v_invite
  FROM plan_invites pi
  JOIN plans p ON p.id = pi.plan_id
  WHERE pi.invite_token = p_token AND pi.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or already used';
  END IF;

  IF v_invite.plan_owner_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot accept your own plan invite';
  END IF;

  IF EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = v_invite.plan_id AND friend_id = v_user_id) THEN
    RAISE EXCEPTION 'Already a participant';
  END IF;

  INSERT INTO plan_participants (plan_id, friend_id, status, role, responded_at)
  VALUES (v_invite.plan_id, v_user_id, 'accepted', 'participant', now());

  UPDATE plan_invites
  SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  SELECT display_name INTO v_user_name FROM profiles WHERE user_id = v_user_id;

  INSERT INTO friendships (user_id, friend_user_id, friend_name, status)
  VALUES (v_invite.invited_by, v_user_id, COALESCE(v_user_name, 'Friend'), 'connected')
  ON CONFLICT DO NOTHING;

  INSERT INTO friendships (user_id, friend_user_id, friend_name, status)
  SELECT v_user_id, v_invite.invited_by, COALESCE(pr.display_name, 'Friend'), 'connected'
  FROM profiles pr WHERE pr.user_id = v_invite.invited_by
  ON CONFLICT DO NOTHING;

  RETURN v_invite.plan_id;
END;
$function$;