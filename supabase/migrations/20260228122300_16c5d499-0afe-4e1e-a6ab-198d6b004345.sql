CREATE POLICY "Recipients can dismiss their own vibes"
ON public.vibe_send_recipients
FOR DELETE
USING ((select auth.uid()) = recipient_id);