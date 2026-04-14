-- Fix infinite recursion: the SELECT policy on trip_proposal_participants
-- references itself via a self-join. Replace with a non-recursive approach.

-- Drop the recursive policy
DROP POLICY IF EXISTS "Participants can view co-participants" ON public.trip_proposal_participants;

-- Create a security definer function to check participation without RLS
CREATE OR REPLACE FUNCTION public.is_trip_proposal_participant(p_proposal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_proposal_participants
    WHERE proposal_id = p_proposal_id
    AND user_id = auth.uid()
  );
$$;

-- Re-create the SELECT policy using the security definer function
CREATE POLICY "Participants can view co-participants"
ON public.trip_proposal_participants
FOR SELECT
TO authenticated
USING (
  public.is_trip_proposal_participant(proposal_id)
);

-- Also fix trip_proposals SELECT policy that has the same circular dependency
DROP POLICY IF EXISTS "Participants can view trip proposals" ON public.trip_proposals;

CREATE POLICY "Participants can view trip proposals"
ON public.trip_proposals
FOR SELECT
TO authenticated
USING (
  public.is_trip_proposal_participant(id)
);