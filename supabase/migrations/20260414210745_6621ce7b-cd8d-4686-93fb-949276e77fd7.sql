ALTER TABLE public.trip_proposals
  ADD COLUMN proposal_type text NOT NULL DEFAULT 'trip',
  ADD COLUMN host_user_id uuid;