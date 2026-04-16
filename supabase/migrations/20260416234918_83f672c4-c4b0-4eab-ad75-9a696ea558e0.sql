-- Trip invites table
CREATE TABLE public.trip_proposal_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.trip_proposals(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  invite_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  invited_by UUID NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_by UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_proposal_invites_token ON public.trip_proposal_invites(invite_token);
CREATE INDEX idx_trip_proposal_invites_proposal ON public.trip_proposal_invites(proposal_id);

ALTER TABLE public.trip_proposal_invites ENABLE ROW LEVEL SECURITY;

-- Creator can insert
CREATE POLICY "Users can create invites for proposals they participate in"
ON public.trip_proposal_invites FOR INSERT
TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND public.is_trip_proposal_participant(proposal_id)
);

-- Creator can view their own invites
CREATE POLICY "Users can view invites they created"
ON public.trip_proposal_invites FOR SELECT
TO authenticated
USING (invited_by = auth.uid());

-- Public read by token via RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_trip_invite_details(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_proposal RECORD;
  v_host RECORD;
  v_dates JSON;
  v_participant_count INT;
BEGIN
  SELECT * INTO v_invite
  FROM trip_proposal_invites
  WHERE invite_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  SELECT tp.id, tp.destination, tp.proposal_type, tp.status, tp.host_user_id, tp.created_by
  INTO v_proposal
  FROM trip_proposals tp
  WHERE tp.id = v_invite.proposal_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'proposal_not_found');
  END IF;

  SELECT p.user_id, p.display_name, p.first_name, p.last_name, p.avatar_url
  INTO v_host
  FROM profiles p
  WHERE p.user_id = COALESCE(v_proposal.host_user_id, v_proposal.created_by);

  SELECT COALESCE(json_agg(json_build_object(
    'id', d.id,
    'start_date', d.start_date,
    'end_date', d.end_date,
    'votes', d.votes
  ) ORDER BY d.start_date), '[]'::json)
  INTO v_dates
  FROM trip_proposal_dates d
  WHERE d.proposal_id = v_proposal.id;

  SELECT COUNT(*) INTO v_participant_count
  FROM trip_proposal_participants
  WHERE proposal_id = v_proposal.id;

  RETURN json_build_object(
    'invite_status', v_invite.status,
    'proposal_id', v_proposal.id,
    'trip_id', v_invite.trip_id,
    'destination', v_proposal.destination,
    'proposal_type', v_proposal.proposal_type,
    'proposal_status', v_proposal.status,
    'host', json_build_object(
      'user_id', v_host.user_id,
      'display_name', v_host.display_name,
      'first_name', v_host.first_name,
      'last_name', v_host.last_name,
      'avatar_url', v_host.avatar_url
    ),
    'dates', v_dates,
    'participant_count', v_participant_count
  );
END;
$$;

-- Accept invite (auth required)
CREATE OR REPLACE FUNCTION public.accept_trip_invite(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_invite RECORD;
  v_proposal RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM trip_proposal_invites
  WHERE invite_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  SELECT * INTO v_proposal
  FROM trip_proposals
  WHERE id = v_invite.proposal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  -- Add to proposal participants if not already there
  INSERT INTO trip_proposal_participants (proposal_id, user_id, status)
  VALUES (v_invite.proposal_id, v_user_id, 'invited')
  ON CONFLICT DO NOTHING;

  -- If a trip already exists (finalized), add to trip_participants
  IF v_invite.trip_id IS NOT NULL THEN
    INSERT INTO trip_participants (trip_id, friend_user_id)
    VALUES (v_invite.trip_id, v_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mark invite accepted (only if still pending)
  IF v_invite.status = 'pending' THEN
    UPDATE trip_proposal_invites
    SET status = 'accepted',
        accepted_by = v_user_id,
        accepted_at = now()
    WHERE id = v_invite.id;
  END IF;

  RETURN json_build_object(
    'proposal_id', v_invite.proposal_id,
    'trip_id', v_invite.trip_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trip_invite_details(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_trip_invite(TEXT) TO authenticated;