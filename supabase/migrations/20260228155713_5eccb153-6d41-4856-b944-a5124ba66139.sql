
-- Create vibe reactions table
CREATE TABLE public.vibe_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vibe_send_id UUID NOT NULL REFERENCES public.vibe_sends(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vibe_send_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.vibe_reactions ENABLE ROW LEVEL SECURITY;

-- Recipients can view reactions on vibes sent to them
CREATE POLICY "Recipients can view vibe reactions"
ON public.vibe_reactions FOR SELECT
USING (check_vibe_recipient(vibe_send_id));

-- Senders can view reactions on their vibes
CREATE POLICY "Senders can view vibe reactions"
ON public.vibe_reactions FOR SELECT
USING (check_vibe_sender(vibe_send_id));

-- Recipients can add reactions (only on vibes sent to them)
CREATE POLICY "Recipients can add vibe reactions"
ON public.vibe_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id AND check_vibe_recipient(vibe_send_id));

-- Users can remove their own reactions
CREATE POLICY "Users can remove their own vibe reactions"
ON public.vibe_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for vibe reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.vibe_reactions;
