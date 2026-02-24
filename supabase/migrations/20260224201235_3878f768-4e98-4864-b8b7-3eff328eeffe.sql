
-- Drop the recursive policy
DROP POLICY "Users can view participants of their conversations" ON public.conversation_participants;

-- Use a function to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.user_conversation_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id FROM public.conversation_participants WHERE user_id = p_user_id;
$$;

-- Non-recursive policy using the function
CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (conversation_id IN (SELECT public.user_conversation_ids(auth.uid())));
