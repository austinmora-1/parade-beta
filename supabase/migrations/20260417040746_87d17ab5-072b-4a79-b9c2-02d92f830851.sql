BEGIN;

-- ============================================================================
-- 1. Remove proposal-era data that was migrated into trips
-- ============================================================================
-- Trip participants rows that came from pending proposals were inserted with
-- trip_id = old proposal id. Those trip rows have status='proposal'.
DELETE FROM public.trip_participants
WHERE trip_id IN (SELECT id FROM public.trips WHERE status = 'proposal');

DELETE FROM public.trips WHERE status = 'proposal';

-- ============================================================================
-- 2. Drop new policies / functions that depend on the new columns
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own or participating trips" ON public.trips;

DROP POLICY IF EXISTS "trip_date_options_select" ON public.trip_date_options;
DROP POLICY IF EXISTS "trip_date_options_insert" ON public.trip_date_options;
DROP POLICY IF EXISTS "trip_date_options_update" ON public.trip_date_options;
DROP POLICY IF EXISTS "trip_date_options_delete" ON public.trip_date_options;
DROP POLICY IF EXISTS "trip_date_votes_select"   ON public.trip_date_votes;
DROP POLICY IF EXISTS "trip_date_votes_write"    ON public.trip_date_votes;
DROP POLICY IF EXISTS "trip_invites_select"      ON public.trip_invites;
DROP POLICY IF EXISTS "trip_invites_write"       ON public.trip_invites;
DROP POLICY IF EXISTS "trip_activity_suggestions_select" ON public.trip_activity_suggestions;
DROP POLICY IF EXISTS "trip_activity_suggestions_write"  ON public.trip_activity_suggestions;
DROP POLICY IF EXISTS "trip_activity_votes_select" ON public.trip_activity_votes;
DROP POLICY IF EXISTS "trip_activity_votes_write"  ON public.trip_activity_votes;

DROP FUNCTION IF EXISTS public.is_trip_participant(uuid);
DROP FUNCTION IF EXISTS public.accept_trip_invite(text);
DROP FUNCTION IF EXISTS public.get_trip_invite_details(text);

-- ============================================================================
-- 3. Drop new tables created by unification
-- ============================================================================
DROP TABLE IF EXISTS public.trip_activity_votes        CASCADE;
DROP TABLE IF EXISTS public.trip_activity_suggestions  CASCADE;
DROP TABLE IF EXISTS public.trip_date_votes            CASCADE;
DROP TABLE IF EXISTS public.trip_date_options          CASCADE;
DROP TABLE IF EXISTS public.trip_invites               CASCADE;

-- Remove proposal-era extra columns added to trip_participants
ALTER TABLE public.trip_participants
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS preferred_date_id,
  DROP COLUMN IF EXISTS user_id;

-- ============================================================================
-- 4. Drop new columns / restore original on trips
-- ============================================================================
ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_status_check,
  DROP CONSTRAINT IF EXISTS trips_proposal_type_check;

ALTER TABLE public.trips
  DROP COLUMN IF EXISTS status         CASCADE,
  DROP COLUMN IF EXISTS proposal_type  CASCADE,
  DROP COLUMN IF EXISTS host_user_id   CASCADE,
  DROP COLUMN IF EXISTS created_by     CASCADE;

-- Restore original "Users can view their own trips" policy
CREATE POLICY "Users can view their own trips" ON public.trips
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 5. Recreate original proposal tables
-- ============================================================================
CREATE TABLE public.trip_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  destination text,
  proposal_type text DEFAULT 'trip',
  host_user_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_proposals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trip_proposal_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.trip_proposals(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  votes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_proposal_dates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trip_proposal_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.trip_proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  preferred_date_id uuid REFERENCES public.trip_proposal_dates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, user_id)
);
ALTER TABLE public.trip_proposal_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trip_proposal_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_id UUID NOT NULL REFERENCES public.trip_proposal_dates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rank INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date_id, user_id)
);
ALTER TABLE public.trip_proposal_votes ENABLE ROW LEVEL SECURITY;

-- Helper function (security definer) to break recursion
CREATE OR REPLACE FUNCTION public.is_trip_proposal_participant(p_proposal_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_proposal_participants
    WHERE proposal_id = p_proposal_id AND user_id = auth.uid()
  );
$$;

-- trip_proposals policies
CREATE POLICY "Users can create their own trip proposals"
  ON public.trip_proposals FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can view their own trip proposals"
  ON public.trip_proposals FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can update their own trip proposals"
  ON public.trip_proposals FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their own trip proposals"
  ON public.trip_proposals FOR DELETE USING (auth.uid() = created_by);
CREATE POLICY "Participants can view trip proposals"
  ON public.trip_proposals FOR SELECT TO authenticated
  USING (public.is_trip_proposal_participant(id));

-- trip_proposal_dates policies
CREATE POLICY "Creator can manage proposal dates"
  ON public.trip_proposal_dates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.trip_proposals tp WHERE tp.id = trip_proposal_dates.proposal_id AND tp.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trip_proposals tp WHERE tp.id = trip_proposal_dates.proposal_id AND tp.created_by = auth.uid()));
CREATE POLICY "Participants can view proposal dates"
  ON public.trip_proposal_dates FOR SELECT
  USING (public.is_trip_proposal_participant(proposal_id));

-- trip_proposal_participants policies
CREATE POLICY "Creator can manage participants"
  ON public.trip_proposal_participants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.trip_proposals tp WHERE tp.id = trip_proposal_participants.proposal_id AND tp.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trip_proposals tp WHERE tp.id = trip_proposal_participants.proposal_id AND tp.created_by = auth.uid()));
CREATE POLICY "Participants can view co-participants"
  ON public.trip_proposal_participants FOR SELECT TO authenticated
  USING (public.is_trip_proposal_participant(proposal_id));
CREATE POLICY "Participants can update their own record"
  ON public.trip_proposal_participants FOR UPDATE USING (auth.uid() = user_id);

-- trip_proposal_votes policies
CREATE POLICY "Participants can view trip votes"
  ON public.trip_proposal_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.trip_proposal_dates tpd
    JOIN public.trip_proposal_participants tpp ON tpp.proposal_id = tpd.proposal_id
    WHERE tpd.id = trip_proposal_votes.date_id AND tpp.user_id = auth.uid()
  ));
CREATE POLICY "Users can submit trip votes"
  ON public.trip_proposal_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.trip_proposal_dates tpd
    JOIN public.trip_proposal_participants tpp ON tpp.proposal_id = tpd.proposal_id
    WHERE tpd.id = trip_proposal_votes.date_id AND tpp.user_id = auth.uid()
  ));
CREATE POLICY "Users can update their trip votes"
  ON public.trip_proposal_votes FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their trip votes"
  ON public.trip_proposal_votes FOR DELETE USING (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER update_trip_proposals_updated_at
  BEFORE UPDATE ON public.trip_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trip_proposal_votes_updated_at
  BEFORE UPDATE ON public.trip_proposal_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Restore proposal_id link on trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.trip_proposals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_trips_proposal_id ON public.trips(proposal_id);

-- ============================================================================
-- 6. Recreate trip_activity_suggestions / votes (proposal-id based)
-- ============================================================================
CREATE TABLE public.trip_activity_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.trip_proposals(id) ON DELETE CASCADE,
  suggested_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trip_activity_suggestions_proposal ON public.trip_activity_suggestions(proposal_id);
ALTER TABLE public.trip_activity_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view activity suggestions"
  ON public.trip_activity_suggestions FOR SELECT TO authenticated
  USING (public.is_trip_proposal_participant(proposal_id));
CREATE POLICY "Participants can add activity suggestions"
  ON public.trip_activity_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = suggested_by AND public.is_trip_proposal_participant(proposal_id));
CREATE POLICY "Suggesters can update own suggestions"
  ON public.trip_activity_suggestions FOR UPDATE TO authenticated
  USING (auth.uid() = suggested_by) WITH CHECK (auth.uid() = suggested_by);
CREATE POLICY "Suggesters can delete own suggestions"
  ON public.trip_activity_suggestions FOR DELETE TO authenticated
  USING (auth.uid() = suggested_by);

CREATE TRIGGER trg_trip_activity_suggestions_updated_at
  BEFORE UPDATE ON public.trip_activity_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trip_activity_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.trip_activity_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, user_id)
);
CREATE INDEX idx_trip_activity_votes_suggestion ON public.trip_activity_votes(suggestion_id);
CREATE INDEX idx_trip_activity_votes_user       ON public.trip_activity_votes(user_id);
ALTER TABLE public.trip_activity_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view activity votes"
  ON public.trip_activity_votes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trip_activity_suggestions s
    WHERE s.id = trip_activity_votes.suggestion_id
      AND public.is_trip_proposal_participant(s.proposal_id)
  ));
CREATE POLICY "Participants can submit activity votes"
  ON public.trip_activity_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.trip_activity_suggestions s
    WHERE s.id = trip_activity_votes.suggestion_id
      AND public.is_trip_proposal_participant(s.proposal_id)
  ));
CREATE POLICY "Users can update own activity votes"
  ON public.trip_activity_votes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own activity votes"
  ON public.trip_activity_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_trip_activity_votes_updated_at
  BEFORE UPDATE ON public.trip_activity_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 7. Recreate trip_proposal_invites + RPCs
-- ============================================================================
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
CREATE INDEX idx_trip_proposal_invites_token    ON public.trip_proposal_invites(invite_token);
CREATE INDEX idx_trip_proposal_invites_proposal ON public.trip_proposal_invites(proposal_id);
ALTER TABLE public.trip_proposal_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create invites for proposals they participate in"
  ON public.trip_proposal_invites FOR INSERT TO authenticated
  WITH CHECK (invited_by = auth.uid() AND public.is_trip_proposal_participant(proposal_id));
CREATE POLICY "Users can view invites they created"
  ON public.trip_proposal_invites FOR SELECT TO authenticated
  USING (invited_by = auth.uid());

CREATE OR REPLACE FUNCTION public.get_trip_invite_details(p_token TEXT)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite RECORD; v_proposal RECORD; v_host RECORD;
  v_dates JSON; v_participant_count INT;
BEGIN
  SELECT * INTO v_invite FROM trip_proposal_invites WHERE invite_token = p_token LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;

  SELECT tp.id, tp.destination, tp.proposal_type, tp.status, tp.host_user_id, tp.created_by
  INTO v_proposal FROM trip_proposals tp WHERE tp.id = v_invite.proposal_id;
  IF NOT FOUND THEN RETURN json_build_object('error', 'proposal_not_found'); END IF;

  SELECT p.user_id, p.display_name, p.first_name, p.last_name, p.avatar_url
  INTO v_host FROM profiles p
  WHERE p.user_id = COALESCE(v_proposal.host_user_id, v_proposal.created_by);

  SELECT COALESCE(json_agg(json_build_object(
    'id', d.id, 'start_date', d.start_date, 'end_date', d.end_date, 'votes', d.votes
  ) ORDER BY d.start_date), '[]'::json)
  INTO v_dates FROM trip_proposal_dates d WHERE d.proposal_id = v_proposal.id;

  SELECT COUNT(*) INTO v_participant_count
  FROM trip_proposal_participants WHERE proposal_id = v_proposal.id;

  RETURN json_build_object(
    'invite_status', v_invite.status,
    'proposal_id', v_proposal.id,
    'trip_id', v_invite.trip_id,
    'destination', v_proposal.destination,
    'proposal_type', v_proposal.proposal_type,
    'proposal_status', v_proposal.status,
    'host', json_build_object(
      'user_id', v_host.user_id, 'display_name', v_host.display_name,
      'first_name', v_host.first_name, 'last_name', v_host.last_name,
      'avatar_url', v_host.avatar_url
    ),
    'dates', v_dates,
    'participant_count', v_participant_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_trip_invite(p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID; v_invite RECORD; v_proposal RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM trip_proposal_invites WHERE invite_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;

  SELECT * INTO v_proposal FROM trip_proposals WHERE id = v_invite.proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;

  INSERT INTO trip_proposal_participants (proposal_id, user_id, status)
  VALUES (v_invite.proposal_id, v_user_id, 'invited')
  ON CONFLICT DO NOTHING;

  IF v_invite.trip_id IS NOT NULL THEN
    INSERT INTO trip_participants (trip_id, friend_user_id)
    VALUES (v_invite.trip_id, v_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_invite.status = 'pending' THEN
    UPDATE trip_proposal_invites
    SET status = 'accepted', accepted_by = v_user_id, accepted_at = now()
    WHERE id = v_invite.id;
  END IF;

  RETURN json_build_object('proposal_id', v_invite.proposal_id, 'trip_id', v_invite.trip_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trip_invite_details(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_trip_invite(TEXT)      TO authenticated;

COMMIT;