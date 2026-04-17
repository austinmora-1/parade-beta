-- ============================================================================
-- UNIFY trips + trip_proposals into a single `trips` entity with lifecycle status
-- ============================================================================

BEGIN;

-- 1. Extend `trips` with proposal-era fields
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'confirmed',  -- 'proposal' | 'confirmed'
  ADD COLUMN IF NOT EXISTS proposal_type  text NOT NULL DEFAULT 'trip',       -- 'trip' | 'visit'
  ADD COLUMN IF NOT EXISTS host_user_id   uuid,                               -- only set for visits
  ADD COLUMN IF NOT EXISTS created_by     uuid;                               -- proposer (defaults to user_id below)

-- Backfill created_by for existing trips
UPDATE public.trips SET created_by = user_id WHERE created_by IS NULL;
ALTER TABLE public.trips ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_status_check        CHECK (status IN ('proposal','confirmed')),
  ADD CONSTRAINT trips_proposal_type_check CHECK (proposal_type IN ('trip','visit'));

CREATE INDEX IF NOT EXISTS idx_trips_status        ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_created_by    ON public.trips(created_by);
CREATE INDEX IF NOT EXISTS idx_trips_host_user_id  ON public.trips(host_user_id) WHERE host_user_id IS NOT NULL;

-- 2. Reflect existing trip_proposals.proposal_type onto already-finalized trips
--    (so confirmed visits stay visits in the new model)
UPDATE public.trips t
SET proposal_type = tp.proposal_type,
    host_user_id  = tp.host_user_id,
    created_by    = tp.created_by
FROM public.trip_proposals tp
WHERE t.proposal_id = tp.id;

-- 3. Migrate pending proposals into `trips` rows
--    Each proposal becomes one trip row owned by created_by, status='proposal'.
--    start_date/end_date span the earliest..latest option.
INSERT INTO public.trips (
  id, user_id, created_by, location, start_date, end_date,
  status, proposal_type, host_user_id, available_slots, priority_friend_ids, needs_return_date,
  created_at, updated_at
)
SELECT
  tp.id,
  tp.created_by AS user_id,
  tp.created_by,
  tp.destination,
  COALESCE((SELECT MIN(start_date) FROM public.trip_proposal_dates d WHERE d.proposal_id = tp.id), CURRENT_DATE),
  COALESCE((SELECT MAX(end_date)   FROM public.trip_proposal_dates d WHERE d.proposal_id = tp.id), CURRENT_DATE),
  'proposal',
  COALESCE(tp.proposal_type, 'trip'),
  tp.host_user_id,
  ARRAY[]::text[],
  ARRAY[]::uuid[],
  false,
  tp.created_at,
  tp.updated_at
FROM public.trip_proposals tp
WHERE tp.status = 'pending'
  -- skip any proposal that already finalized into a trip (already migrated above)
  AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.proposal_id = tp.id)
ON CONFLICT (id) DO NOTHING;

-- 4. Create unified child tables
CREATE TABLE IF NOT EXISTS public.trip_date_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  votes       int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_date_options_trip_id ON public.trip_date_options(trip_id);

CREATE TABLE IF NOT EXISTS public.trip_date_votes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_id       uuid NOT NULL REFERENCES public.trip_date_options(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  rank          int  NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_trip_date_votes_date_id ON public.trip_date_votes(date_id);
CREATE INDEX IF NOT EXISTS idx_trip_date_votes_user_id ON public.trip_date_votes(user_id);

CREATE TABLE IF NOT EXISTS public.trip_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  invited_by    uuid NOT NULL,
  email         text,
  invite_token  text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  status        text NOT NULL DEFAULT 'pending',
  accepted_by   uuid,
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_invites_trip_id ON public.trip_invites(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_invites_token   ON public.trip_invites(invite_token);

-- 5. Extend trip_participants with proposal-era status + preferred_date_id
ALTER TABLE public.trip_participants
  ADD COLUMN IF NOT EXISTS status            text NOT NULL DEFAULT 'accepted',  -- invited|voted|accepted|declined
  ADD COLUMN IF NOT EXISTS preferred_date_id uuid REFERENCES public.trip_date_options(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id           uuid;  -- alias of friend_user_id, populated below

UPDATE public.trip_participants SET user_id = friend_user_id WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_trip_participants_user_id ON public.trip_participants(user_id);

-- 6. Migrate trip_proposal_dates → trip_date_options (preserve IDs for vote FKs)
INSERT INTO public.trip_date_options (id, trip_id, start_date, end_date, votes, created_at)
SELECT d.id, COALESCE(t.id, d.proposal_id), d.start_date, d.end_date, d.votes, d.created_at
FROM public.trip_proposal_dates d
LEFT JOIN public.trips t ON t.id = d.proposal_id  -- pending proposals migrated with same id
WHERE EXISTS (SELECT 1 FROM public.trips tt WHERE tt.id = COALESCE(t.id, d.proposal_id))
ON CONFLICT (id) DO NOTHING;

-- 7. Migrate trip_proposal_participants → trip_participants
--    For pending proposals, the trip row now has the proposal's id, so use that.
INSERT INTO public.trip_participants (trip_id, friend_user_id, user_id, status, preferred_date_id, created_at)
SELECT
  pp.proposal_id AS trip_id,
  pp.user_id     AS friend_user_id,
  pp.user_id,
  pp.status,
  pp.preferred_date_id,
  pp.created_at
FROM public.trip_proposal_participants pp
WHERE EXISTS (SELECT 1 FROM public.trips t WHERE t.id = pp.proposal_id)
  -- avoid dupes if the participant already exists from finalized trip flow
  AND NOT EXISTS (
    SELECT 1 FROM public.trip_participants tp
    WHERE tp.trip_id = pp.proposal_id AND tp.friend_user_id = pp.user_id
  );

-- 8. Migrate trip_proposal_votes → trip_date_votes
INSERT INTO public.trip_date_votes (id, date_id, user_id, rank, created_at, updated_at)
SELECT v.id, v.date_id, v.user_id, v.rank, v.created_at, v.updated_at
FROM public.trip_proposal_votes v
WHERE EXISTS (SELECT 1 FROM public.trip_date_options o WHERE o.id = v.date_id)
ON CONFLICT (id) DO NOTHING;

-- 9. Migrate trip_proposal_invites → trip_invites
INSERT INTO public.trip_invites (id, trip_id, invited_by, email, invite_token, status, accepted_by, accepted_at, created_at)
SELECT
  i.id,
  COALESCE(i.trip_id, i.proposal_id) AS trip_id,
  i.invited_by, i.email, i.invite_token, i.status, i.accepted_by, i.accepted_at, i.created_at
FROM public.trip_proposal_invites i
WHERE EXISTS (SELECT 1 FROM public.trips t WHERE t.id = COALESCE(i.trip_id, i.proposal_id))
ON CONFLICT (id) DO NOTHING;

-- 10. Drop the now-obsolete proposal tables and proposal_id column
ALTER TABLE public.trips DROP COLUMN IF EXISTS proposal_id;

DROP TABLE IF EXISTS public.trip_proposal_votes        CASCADE;
DROP TABLE IF EXISTS public.trip_proposal_invites      CASCADE;
DROP TABLE IF EXISTS public.trip_proposal_participants CASCADE;
DROP TABLE IF EXISTS public.trip_proposal_dates        CASCADE;
DROP TABLE IF EXISTS public.trip_activity_votes        CASCADE;
DROP TABLE IF EXISTS public.trip_activity_suggestions  CASCADE;
DROP TABLE IF EXISTS public.trip_proposals             CASCADE;

-- Re-create activity suggestions/votes against trips directly
CREATE TABLE public.trip_activity_suggestions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  suggested_by  uuid NOT NULL,
  title         text NOT NULL,
  description   text,
  sort_order    int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trip_activity_suggestions_trip_id ON public.trip_activity_suggestions(trip_id);

CREATE TABLE public.trip_activity_votes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id   uuid NOT NULL REFERENCES public.trip_activity_suggestions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  rank            int  NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, user_id)
);
CREATE INDEX idx_trip_activity_votes_suggestion ON public.trip_activity_votes(suggestion_id);

-- 11. Drop obsolete RPCs that reference removed tables
DROP FUNCTION IF EXISTS public.is_trip_proposal_participant(uuid);
DROP FUNCTION IF EXISTS public.accept_trip_invite(text);
DROP FUNCTION IF EXISTS public.get_trip_invite_details(text);

-- New helper: is the caller a participant of this trip?
CREATE OR REPLACE FUNCTION public.is_trip_participant(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_participants
    WHERE trip_id = p_trip_id AND user_id = auth.uid()
  );
$$;

-- New accept_trip_invite (works against unified trips)
CREATE OR REPLACE FUNCTION public.accept_trip_invite(p_token text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_invite  RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.trip_invites WHERE invite_token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;

  INSERT INTO public.trip_participants (trip_id, friend_user_id, user_id, status)
  VALUES (v_invite.trip_id, v_user_id, v_user_id, 'invited')
  ON CONFLICT DO NOTHING;

  IF v_invite.status = 'pending' THEN
    UPDATE public.trip_invites
    SET status = 'accepted', accepted_by = v_user_id, accepted_at = now()
    WHERE id = v_invite.id;
  END IF;

  RETURN json_build_object('trip_id', v_invite.trip_id);
END;
$$;

-- New get_trip_invite_details
CREATE OR REPLACE FUNCTION public.get_trip_invite_details(p_token text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_trip   RECORD;
  v_host   RECORD;
  v_dates  json;
  v_count  int;
BEGIN
  SELECT * INTO v_invite FROM public.trip_invites WHERE invite_token = p_token LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('error','not_found'); END IF;

  SELECT id, location AS destination, proposal_type, status, host_user_id, created_by, start_date, end_date
  INTO v_trip FROM public.trips WHERE id = v_invite.trip_id;
  IF NOT FOUND THEN RETURN json_build_object('error','trip_not_found'); END IF;

  SELECT user_id, display_name, first_name, last_name, avatar_url
  INTO v_host FROM public.profiles
  WHERE user_id = COALESCE(v_trip.host_user_id, v_trip.created_by);

  SELECT COALESCE(json_agg(json_build_object(
    'id', d.id, 'start_date', d.start_date, 'end_date', d.end_date, 'votes', d.votes
  ) ORDER BY d.start_date), '[]'::json)
  INTO v_dates FROM public.trip_date_options d WHERE d.trip_id = v_trip.id;

  SELECT COUNT(*) INTO v_count FROM public.trip_participants WHERE trip_id = v_trip.id;

  RETURN json_build_object(
    'invite_status', v_invite.status,
    'trip_id',       v_trip.id,
    'destination',   v_trip.destination,
    'proposal_type', v_trip.proposal_type,
    'trip_status',   v_trip.status,
    'start_date',    v_trip.start_date,
    'end_date',      v_trip.end_date,
    'host', json_build_object(
      'user_id', v_host.user_id, 'display_name', v_host.display_name,
      'first_name', v_host.first_name, 'last_name', v_host.last_name,
      'avatar_url', v_host.avatar_url
    ),
    'dates', v_dates,
    'participant_count', v_count
  );
END;
$$;

-- 12. RLS on new tables
ALTER TABLE public.trip_date_options          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_date_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_invites               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_activity_suggestions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_activity_votes        ENABLE ROW LEVEL SECURITY;

-- trip_date_options: viewable by trip owner or participants; mutated by owner
CREATE POLICY "trip_date_options_select" ON public.trip_date_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.user_id = auth.uid() OR t.created_by = auth.uid()))
         OR public.is_trip_participant(trip_id));
CREATE POLICY "trip_date_options_insert" ON public.trip_date_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.user_id = auth.uid() OR t.created_by = auth.uid())));
CREATE POLICY "trip_date_options_update" ON public.trip_date_options FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.user_id = auth.uid() OR t.created_by = auth.uid())));
CREATE POLICY "trip_date_options_delete" ON public.trip_date_options FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.user_id = auth.uid() OR t.created_by = auth.uid())));

-- trip_date_votes: each user manages their own
CREATE POLICY "trip_date_votes_select" ON public.trip_date_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_date_options o JOIN public.trips t ON t.id = o.trip_id
                 WHERE o.id = date_id AND (t.user_id = auth.uid() OR t.created_by = auth.uid() OR public.is_trip_participant(t.id))));
CREATE POLICY "trip_date_votes_write" ON public.trip_date_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- trip_invites: trip owner manages; invitee can read by token (public RPC handles that)
CREATE POLICY "trip_invites_select" ON public.trip_invites FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.user_id = auth.uid() OR t.created_by = auth.uid())));
CREATE POLICY "trip_invites_write" ON public.trip_invites FOR ALL TO authenticated
  USING (invited_by = auth.uid()) WITH CHECK (invited_by = auth.uid());

-- trip_activity_suggestions / votes: any participant
CREATE POLICY "trip_activity_suggestions_select" ON public.trip_activity_suggestions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.user_id = auth.uid() OR t.created_by = auth.uid() OR public.is_trip_participant(t.id))));
CREATE POLICY "trip_activity_suggestions_write" ON public.trip_activity_suggestions FOR ALL TO authenticated
  USING (suggested_by = auth.uid()) WITH CHECK (suggested_by = auth.uid());

CREATE POLICY "trip_activity_votes_select" ON public.trip_activity_votes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trip_activity_suggestions s JOIN public.trips t ON t.id = s.trip_id
    WHERE s.id = suggestion_id AND (t.user_id = auth.uid() OR t.created_by = auth.uid() OR public.is_trip_participant(t.id))
  ));
CREATE POLICY "trip_activity_votes_write" ON public.trip_activity_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 13. Broaden trips RLS so participants can see proposal trips they're invited to
DROP POLICY IF EXISTS "Users can view their own trips" ON public.trips;
CREATE POLICY "Users can view their own or participating trips" ON public.trips FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid() OR public.is_trip_participant(id));

-- updated_at triggers
DROP TRIGGER IF EXISTS update_trip_date_votes_updated_at ON public.trip_date_votes;
CREATE TRIGGER update_trip_date_votes_updated_at BEFORE UPDATE ON public.trip_date_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_activity_suggestions_updated_at ON public.trip_activity_suggestions;
CREATE TRIGGER update_trip_activity_suggestions_updated_at BEFORE UPDATE ON public.trip_activity_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_trip_activity_votes_updated_at ON public.trip_activity_votes;
CREATE TRIGGER update_trip_activity_votes_updated_at BEFORE UPDATE ON public.trip_activity_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;