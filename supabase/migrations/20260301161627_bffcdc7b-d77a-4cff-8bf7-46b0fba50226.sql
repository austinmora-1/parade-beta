
-- Add edited_at column to track when messages were edited
ALTER TABLE public.chat_messages ADD COLUMN edited_at timestamp with time zone DEFAULT NULL;

-- Allow users to update their own messages
CREATE POLICY "Users can update their own messages"
ON public.chat_messages
FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- Allow users to delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.chat_messages
FOR DELETE
USING (auth.uid() = sender_id);
