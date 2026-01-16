-- Add a short shareable code to profiles
ALTER TABLE public.profiles
ADD COLUMN share_code TEXT UNIQUE;

-- Create function to generate random short codes
CREATE OR REPLACE FUNCTION public.generate_share_code(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Populate existing profiles with share codes
UPDATE public.profiles
SET share_code = public.generate_share_code(8)
WHERE share_code IS NULL;

-- Make share_code not null after populating
ALTER TABLE public.profiles
ALTER COLUMN share_code SET NOT NULL;

-- Set default for new profiles
ALTER TABLE public.profiles
ALTER COLUMN share_code SET DEFAULT public.generate_share_code(8);

-- Create index for fast lookups
CREATE INDEX idx_profiles_share_code ON public.profiles(share_code);