-- Enable pgsodium extension for encryption
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Create a server key for encrypting calendar tokens
SELECT pgsodium.create_key(
  name := 'calendar_tokens_key',
  key_type := 'aead-det'
);

-- Add encrypted columns to calendar_connections
ALTER TABLE public.calendar_connections 
ADD COLUMN access_token_encrypted bytea,
ADD COLUMN refresh_token_encrypted bytea,
ADD COLUMN key_id uuid;

-- Create function to encrypt tokens
CREATE OR REPLACE FUNCTION public.encrypt_calendar_token(token text, p_key_id uuid)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgsodium.crypto_aead_det_encrypt(
    convert_to(token, 'utf8'),
    convert_to('calendar_token', 'utf8'),
    p_key_id
  );
END;
$$;

-- Create function to decrypt tokens (only callable by service role)
CREATE OR REPLACE FUNCTION public.decrypt_calendar_token(encrypted_token bytea, p_key_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN convert_from(
    pgsodium.crypto_aead_det_decrypt(
      encrypted_token,
      convert_to('calendar_token', 'utf8'),
      p_key_id
    ),
    'utf8'
  );
END;
$$;

-- Revoke direct access to decrypt function from public
REVOKE ALL ON FUNCTION public.decrypt_calendar_token(bytea, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_calendar_token(bytea, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.decrypt_calendar_token(bytea, uuid) FROM authenticated;

-- Migrate existing tokens to encrypted columns
DO $$
DECLARE
  key_record RECORD;
BEGIN
  SELECT id INTO key_record FROM pgsodium.valid_key WHERE name = 'calendar_tokens_key' LIMIT 1;
  
  IF key_record.id IS NOT NULL THEN
    UPDATE public.calendar_connections
    SET 
      access_token_encrypted = public.encrypt_calendar_token(access_token, key_record.id),
      refresh_token_encrypted = public.encrypt_calendar_token(refresh_token, key_record.id),
      key_id = key_record.id
    WHERE access_token IS NOT NULL;
  END IF;
END;
$$;

-- Drop the plain text columns after migration
ALTER TABLE public.calendar_connections 
DROP COLUMN access_token,
DROP COLUMN refresh_token;

-- Rename encrypted columns
ALTER TABLE public.calendar_connections 
RENAME COLUMN access_token_encrypted TO access_token;
ALTER TABLE public.calendar_connections 
RENAME COLUMN refresh_token_encrypted TO refresh_token;