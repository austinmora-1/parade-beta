-- Link finalized per-user trips back to their shared proposal
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.trip_proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_proposal_id ON public.trips(proposal_id);

-- Activity suggestions for a confirmed trip/visit
CREATE TABLE IF NOT EXISTS public.trip_activity_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.trip_proposals(id) ON DELETE CASCADE,
  suggested_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_activity_suggestions_proposal ON public.trip_activity_suggestions(proposal_id);

ALTER TABLE public.trip_activity_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view activity suggestions"
  ON public.trip_activity_suggestions FOR SELECT
  TO authenticated
  USING (public.is_trip_proposal_participant(proposal_id));

CREATE POLICY "Participants can add activity suggestions"
  ON public.trip_activity_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = suggested_by
    AND public.is_trip_proposal_participant(proposal_id)
  );

CREATE POLICY "Suggesters can update own suggestions"
  ON public.trip_activity_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = suggested_by)
  WITH CHECK (auth.uid() = suggested_by);

CREATE POLICY "Suggesters can delete own suggestions"
  ON public.trip_activity_suggestions FOR DELETE
  TO authenticated
  USING (auth.uid() = suggested_by);

CREATE TRIGGER trg_trip_activity_suggestions_updated_at
  BEFORE UPDATE ON public.trip_activity_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Borda-count ranked votes on activity suggestions
CREATE TABLE IF NOT EXISTS public.trip_activity_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.trip_activity_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rank integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_activity_votes_suggestion ON public.trip_activity_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_trip_activity_votes_user ON public.trip_activity_votes(user_id);

ALTER TABLE public.trip_activity_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view activity votes"
  ON public.trip_activity_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_activity_suggestions s
      WHERE s.id = trip_activity_votes.suggestion_id
        AND public.is_trip_proposal_participant(s.proposal_id)
    )
  );

CREATE POLICY "Participants can submit activity votes"
  ON public.trip_activity_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.trip_activity_suggestions s
      WHERE s.id = trip_activity_votes.suggestion_id
        AND public.is_trip_proposal_participant(s.proposal_id)
    )
  );

CREATE POLICY "Users can update own activity votes"
  ON public.trip_activity_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own activity votes"
  ON public.trip_activity_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_trip_activity_votes_updated_at
  BEFORE UPDATE ON public.trip_activity_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();