
-- Fix conversations SELECT policy to use the function too
DROP POLICY "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (id IN (SELECT public.user_conversation_ids(auth.uid())));

-- Fix conversations UPDATE policy
DROP POLICY "Users can update their conversations" ON public.conversations;
CREATE POLICY "Users can update their conversations"
  ON public.conversations FOR UPDATE
  USING (id IN (SELECT public.user_conversation_ids(auth.uid())));

-- Fix chat_messages SELECT policy
DROP POLICY "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_messages FOR SELECT
  USING (conversation_id IN (SELECT public.user_conversation_ids(auth.uid())));

-- Fix chat_messages INSERT policy
DROP POLICY "Users can send messages to their conversations" ON public.chat_messages;
CREATE POLICY "Users can send messages to their conversations"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND conversation_id IN (SELECT public.user_conversation_ids(auth.uid()))
  );
