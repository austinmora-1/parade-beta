
-- Create vibe_comments table
CREATE TABLE public.vibe_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vibe_send_id UUID NOT NULL REFERENCES public.vibe_sends(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vibe_comments ENABLE ROW LEVEL SECURITY;

-- Senders can view comments on their vibes
CREATE POLICY "Senders can view comments on their vibes"
  ON public.vibe_comments FOR SELECT
  USING (check_vibe_sender(vibe_send_id));

-- Recipients can view comments on vibes sent to them
CREATE POLICY "Recipients can view comments on vibes they received"
  ON public.vibe_comments FOR SELECT
  USING (check_vibe_recipient(vibe_send_id));

-- Recipients can add comments (they are recipients of the vibe)
CREATE POLICY "Recipients can add comments"
  ON public.vibe_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND check_vibe_recipient(vibe_send_id));

-- Senders can add comments on their own vibes
CREATE POLICY "Senders can add comments on their vibes"
  ON public.vibe_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND check_vibe_sender(vibe_send_id));

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON public.vibe_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for live comment updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.vibe_comments;
