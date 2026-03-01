-- Make sensitive buckets private (keep avatars public)
UPDATE storage.buckets SET public = false WHERE id IN ('chat-images', 'plan-photos', 'vibe-media');

-- Add SELECT policies for authenticated users
CREATE POLICY "Authenticated users can view chat images"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images' AND (select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can view plan photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'plan-photos' AND (select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can view vibe media"
ON storage.objects FOR SELECT
USING (bucket_id = 'vibe-media' AND (select auth.uid()) IS NOT NULL);