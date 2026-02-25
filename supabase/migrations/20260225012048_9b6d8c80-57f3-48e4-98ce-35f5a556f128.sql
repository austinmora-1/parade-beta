-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view plans they are invited to" ON public.plans;

-- Replace with a SECURITY DEFINER function to break the recursion
CREATE OR REPLACE FUNCTION public.user_participated_plan_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT plan_id FROM public.plan_participants WHERE friend_id = p_user_id;
$$;

-- Recreate the policy using the function (no recursion)
CREATE POLICY "Users can view plans they are invited to"
ON public.plans
FOR SELECT
USING (id IN (SELECT user_participated_plan_ids(auth.uid())));