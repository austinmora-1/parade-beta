
-- Table to store external plan invitations
CREATE TABLE public.plan_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL,
  invite_token TEXT NOT NULL DEFAULT generate_share_code(12) UNIQUE,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID
);

-- Enable RLS
ALTER TABLE public.plan_invites ENABLE ROW LEVEL SECURITY;

-- Plan owners can manage invites
CREATE POLICY "Plan owners can manage invites"
  ON public.plan_invites
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM plans WHERE plans.id = plan_invites.plan_id AND plans.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM plans WHERE plans.id = plan_invites.plan_id AND plans.user_id = auth.uid()
  ));

-- Anyone can view an invite by token (for the public page) - using security definer function instead
CREATE OR REPLACE FUNCTION public.get_plan_invite_details(p_token TEXT)
RETURNS TABLE (
  invite_id UUID,
  plan_id UUID,
  plan_title TEXT,
  plan_activity TEXT,
  plan_date TIMESTAMP WITH TIME ZONE,
  plan_time_slot TEXT,
  plan_duration INTEGER,
  plan_location TEXT,
  plan_notes TEXT,
  plan_start_time TIME,
  plan_end_time TIME,
  invited_by_name TEXT,
  invited_by_avatar TEXT,
  invite_status TEXT,
  invite_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.id AS invite_id,
    p.id AS plan_id,
    p.title AS plan_title,
    p.activity AS plan_activity,
    p.date AS plan_date,
    p.time_slot AS plan_time_slot,
    p.duration AS plan_duration,
    p.location AS plan_location,
    p.notes AS plan_notes,
    p.start_time AS plan_start_time,
    p.end_time AS plan_end_time,
    pr.display_name AS invited_by_name,
    pr.avatar_url AS invited_by_avatar,
    pi.status AS invite_status,
    pi.email AS invite_email
  FROM plan_invites pi
  JOIN plans p ON p.id = pi.plan_id
  JOIN profiles pr ON pr.user_id = pi.invited_by
  WHERE pi.invite_token = p_token
  LIMIT 1;
END;
$$;

-- Function to accept a plan invite (called by authenticated users)
CREATE OR REPLACE FUNCTION public.accept_plan_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the invite
  SELECT pi.*, p.user_id AS plan_owner_id
  INTO v_invite
  FROM plan_invites pi
  JOIN plans p ON p.id = pi.plan_id
  WHERE pi.invite_token = p_token AND pi.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or already used';
  END IF;

  -- Don't let the plan owner accept their own invite
  IF v_invite.plan_owner_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot accept your own plan invite';
  END IF;

  -- Check if already a participant
  IF EXISTS (SELECT 1 FROM plan_participants WHERE plan_id = v_invite.plan_id AND friend_id = v_user_id) THEN
    RAISE EXCEPTION 'Already a participant';
  END IF;

  -- Add as participant
  INSERT INTO plan_participants (plan_id, friend_id, status, role)
  VALUES (v_invite.plan_id, v_user_id, 'accepted', 'participant');

  -- Update invite status
  UPDATE plan_invites
  SET status = 'accepted', accepted_at = now(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  -- Auto-create friendship if not exists
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
$$;

-- Trigger: when a user signs up, check if they have pending plan invites by email
CREATE OR REPLACE FUNCTION public.link_plan_invites_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    -- Add as participant
    INSERT INTO plan_participants (plan_id, friend_id, status, role)
    VALUES (r.plan_id, NEW.id, 'accepted', 'participant')
    ON CONFLICT DO NOTHING;

    -- Update invite
    UPDATE plan_invites
    SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id
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
$$;

CREATE TRIGGER on_auth_user_created_link_plan_invites
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_plan_invites_on_signup();
