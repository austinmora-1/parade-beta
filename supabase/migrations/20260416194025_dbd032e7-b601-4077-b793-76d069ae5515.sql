-- Allow authenticated users to view discoverable profiles (limited fields exposed via public_profiles view)
CREATE POLICY "Authenticated users can view discoverable profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (discoverable = true);

-- Make discoverable default to true and backfill existing users
ALTER TABLE public.profiles ALTER COLUMN discoverable SET DEFAULT true;
UPDATE public.profiles SET discoverable = true WHERE discoverable IS NULL OR discoverable = false;