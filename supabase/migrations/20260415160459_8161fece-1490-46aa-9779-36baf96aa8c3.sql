
-- Create trip_proposal_votes table for ranked multi-date voting
CREATE TABLE public.trip_proposal_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_id UUID NOT NULL REFERENCES public.trip_proposal_dates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rank INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (date_id, user_id)
);

-- Enable RLS
ALTER TABLE public.trip_proposal_votes ENABLE ROW LEVEL SECURITY;

-- Participants can view votes for their proposals
CREATE POLICY "Participants can view trip votes"
ON public.trip_proposal_votes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trip_proposal_dates tpd
    JOIN public.trip_proposal_participants tpp ON tpp.proposal_id = tpd.proposal_id
    WHERE tpd.id = trip_proposal_votes.date_id
    AND tpp.user_id = auth.uid()
  )
);

-- Users can submit votes on proposals they participate in
CREATE POLICY "Users can submit trip votes"
ON public.trip_proposal_votes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.trip_proposal_dates tpd
    JOIN public.trip_proposal_participants tpp ON tpp.proposal_id = tpd.proposal_id
    WHERE tpd.id = trip_proposal_votes.date_id
    AND tpp.user_id = auth.uid()
  )
);

-- Users can update their own votes
CREATE POLICY "Users can update their trip votes"
ON public.trip_proposal_votes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete their trip votes"
ON public.trip_proposal_votes
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_trip_proposal_votes_updated_at
BEFORE UPDATE ON public.trip_proposal_votes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
