
-- Create a public storage bucket for OG meta HTML pages
-- These are served directly by Supabase Storage with correct Content-Type headers
INSERT INTO storage.buckets (id, name, public)
VALUES ('og-pages', 'og-pages', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to og-pages
CREATE POLICY "OG pages are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'og-pages');

-- Allow edge functions (service role) to insert/update/delete og-pages
-- Service role bypasses RLS, so no explicit insert policy needed
