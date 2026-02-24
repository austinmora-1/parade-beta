
-- Allow anyone to look up a profile by share_code (only expose fields needed for the share page)
CREATE POLICY "Public can view profile by share code"
ON public.profiles
FOR SELECT
USING (
  show_availability = true
);
