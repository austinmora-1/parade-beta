-- Create a policy to allow public read access to availability for users who allow it
CREATE POLICY "Public can view availability of users who allow it"
ON public.availability FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = availability.user_id
    AND profiles.show_availability = true
  )
);

-- Create a policy to allow public read access to profiles for users who are discoverable
CREATE POLICY "Public can view discoverable profiles"
ON public.profiles FOR SELECT
USING (discoverable = true);