-- Allow conversation creators to read their own newly created conversation rows
-- before participant rows are inserted (needed for INSERT ... RETURNING).
DROP POLICY "Users can view their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    created_by = auth.uid()
    OR id IN (SELECT public.user_conversation_ids(auth.uid()))
  );