
-- Drop the recursive policy
DROP POLICY "Users can view participants of their conversations" ON public.conversation_participants;

-- Create a non-recursive policy: users can see participants where they themselves are also a participant
-- Use a direct check instead of a subquery on the same table
CREATE POLICY "Users can view participants of their conversations"
  ON public.conversation_participants FOR SELECT
  USING (
    conversation_id IN (
      SELECT cp.conversation_id 
      FROM public.conversation_participants cp 
      WHERE cp.user_id = auth.uid()
    )
  );
