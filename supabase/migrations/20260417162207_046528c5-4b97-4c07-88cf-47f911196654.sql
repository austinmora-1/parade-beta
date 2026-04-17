
-- Normalize phone numbers to digits-only for uniqueness check
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');
$$;

-- Unique partial index on lowercased display_name (case-insensitive username uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_unique_ci
  ON public.profiles (lower(display_name))
  WHERE display_name IS NOT NULL;

-- Unique partial index on normalized phone number
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_number_unique
  ON public.profiles (public.normalize_phone(phone_number))
  WHERE phone_number IS NOT NULL AND public.normalize_phone(phone_number) IS NOT NULL;

-- RPC to check phone availability for the current user
CREATE OR REPLACE FUNCTION public.check_phone_available(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.normalize_phone(phone_number) = public.normalize_phone(p_phone)
      AND public.normalize_phone(p_phone) IS NOT NULL
      AND user_id != COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

-- Update handle_new_user to NOT default display_name to email (would violate unique index for similar emails / require user to set it during onboarding)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''));
  RETURN NEW;
END;
$$;
