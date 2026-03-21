
CREATE OR REPLACE FUNCTION public.link_plan_invites_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_user_name TEXT;
BEGIN
  -- Find pending plan invites for this email
  FOR r IN
    SELECT pi.id, pi.plan_id, pi.invited_by
    FROM plan_invites pi
    WHERE pi.email = NEW.email AND pi.status = 'pending'
  LOOP
    -- Add as participant with 'invited' status (pending RSVP)
    INSERT INTO plan_participants (plan_id, friend_id, status, role)
    VALUES (r.plan_id, NEW.id, 'invited', 'participant')
    ON CONFLICT DO NOTHING;

    -- Mark invite as linked (not yet accepted by user)
    UPDATE plan_invites
    SET status = 'linked', accepted_by = NEW.id
    WHERE id = r.id;

    -- Auto-create friendships
    v_user_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email);

    INSERT INTO friendships (user_id, friend_user_id, friend_name, status)
    VALUES (r.invited_by, NEW.id, v_user_name, 'connected')
    ON CONFLICT DO NOTHING;

    INSERT INTO friendships (user_id, friend_user_id, friend_name, status)
    SELECT NEW.id, r.invited_by, COALESCE(pr.display_name, 'Friend'), 'connected'
    FROM profiles pr WHERE pr.user_id = r.invited_by
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$function$;
