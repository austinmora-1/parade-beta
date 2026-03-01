
-- Add reply_to_id column to support message replies
ALTER TABLE public.chat_messages 
ADD COLUMN reply_to_id uuid DEFAULT NULL REFERENCES public.chat_messages(id) ON DELETE SET NULL;

-- Index for fast lookups of replies
CREATE INDEX idx_chat_messages_reply_to_id ON public.chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
