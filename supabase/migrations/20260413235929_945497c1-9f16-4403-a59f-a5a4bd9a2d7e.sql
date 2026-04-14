
-- 1. Create all three tables first (no cross-references in RLS yet)

CREATE TABLE public.trip_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  destination text,
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

-- 2. RLS policies for trip_proposals
CREATE POLICY "Users can create their own trip proposals"
ON public.trip_proposals FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their own trip proposals"
ON public.trip_proposals FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can update their own trip proposals"
ON public.trip_proposals FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own trip proposals"
ON public.trip_proposals FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Participants can view trip proposals"
ON public.trip_proposals FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.trip_proposal_participants tpp
  WHERE tpp.proposal_id = trip_proposals.id AND tpp.user_id = auth.uid()
));

-- 3. RLS policies for trip_proposal_dates
CREATE POLICY "Creator can manage proposal dates"
ON public.trip_proposal_dates FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.trip_proposals tp
  WHERE tp.id = trip_proposal_dates.proposal_id AND tp.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.trip_proposals tp
  WHERE tp.id = trip_proposal_dates.proposal_id AND tp.created_by = auth.uid()
));

CREATE POLICY "Participants can view proposal dates"
ON public.trip_proposal_dates FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.trip_proposal_participants tpp
  WHERE tpp.proposal_id = trip_proposal_dates.proposal_id AND tpp.user_id = auth.uid()
));

-- 4. RLS policies for trip_proposal_participants
CREATE POLICY "Creator can manage participants"
ON public.trip_proposal_participants FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.trip_proposals tp
  WHERE tp.id = trip_proposal_participants.proposal_id AND tp.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.trip_proposals tp
  WHERE tp.id = trip_proposal_participants.proposal_id AND tp.created_by = auth.uid()
));

CREATE POLICY "Participants can view co-participants"
ON public.trip_proposal_participants FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.trip_proposal_participants tpp2
  WHERE tpp2.proposal_id = trip_proposal_participants.proposal_id AND tpp2.user_id = auth.uid()
));

CREATE POLICY "Participants can update their own record"
ON public.trip_proposal_participants FOR UPDATE
USING (auth.uid() = user_id);

-- 5. Trigger
CREATE TRIGGER update_trip_proposals_updated_at
BEFORE UPDATE ON public.trip_proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
