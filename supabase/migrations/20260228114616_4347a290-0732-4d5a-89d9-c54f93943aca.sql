-- Create vibe_sends table for storing sent vibes
CREATE TABLE public.vibe_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  vibe_type TEXT NOT NULL,
  custom_tags TEXT[] DEFAULT '{}'::text[],
  message TEXT,
  media_url TEXT,
  media_type TEXT, -- 'image', 'gif', 'sticker'
  location_name TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  target_type TEXT NOT NULL DEFAULT 'broadcast', -- 'broadcast', 'pod', 'selected'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vibe_send_recipients table for targeted sends
CREATE TABLE public.vibe_send_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vibe_send_id UUID NOT NULL REFERENCES public.vibe_sends(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vibe_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vibe_send_recipients ENABLE ROW LEVEL SECURITY;

-- Policies for vibe_sends
CREATE POLICY "Users can create their own vibes"
  ON public.vibe_sends FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view vibes they sent"
  ON public.vibe_sends FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Users can view vibes sent to them"
  ON public.vibe_sends FOR SELECT
  USING (
    id IN (
      SELECT vibe_send_id FROM public.vibe_send_recipients WHERE recipient_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own vibes"
  ON public.vibe_sends FOR DELETE
  USING (auth.uid() = sender_id);

-- Policies for vibe_send_recipients
CREATE POLICY "Senders can insert recipients"
  ON public.vibe_send_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vibe_sends WHERE id = vibe_send_id AND sender_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can view their own entries"
  ON public.vibe_send_recipients FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "Senders can view recipients of their vibes"
  ON public.vibe_send_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vibe_sends WHERE id = vibe_send_id AND sender_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can update their own read status"
  ON public.vibe_send_recipients FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Create indexes for performance
CREATE INDEX idx_vibe_sends_sender ON public.vibe_sends(sender_id);
CREATE INDEX idx_vibe_sends_created ON public.vibe_sends(created_at DESC);
CREATE INDEX idx_vibe_recipients_recipient ON public.vibe_send_recipients(recipient_id);
CREATE INDEX idx_vibe_recipients_vibe ON public.vibe_send_recipients(vibe_send_id);

-- Enable realtime for live vibe updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.vibe_send_recipients;

-- Create storage bucket for vibe media
INSERT INTO storage.buckets (id, name, public) VALUES ('vibe-media', 'vibe-media', true);

-- Storage policies for vibe media
CREATE POLICY "Authenticated users can upload vibe media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vibe-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view vibe media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vibe-media');

CREATE POLICY "Users can delete their own vibe media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'vibe-media' AND auth.uid()::text = (storage.foldername(name))[1]);
