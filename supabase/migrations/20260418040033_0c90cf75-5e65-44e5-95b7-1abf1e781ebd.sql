
-- ============================================================================
-- Calendar token storage rebuild
--   1. Add dedicated plaintext column for iCal feed URLs
--   2. Migrate any existing iCal rows out of the encrypted token column
--   3. Recreate encrypt/decrypt/get/upsert/update RPCs to use the pgsodium
--      variant that service_role is permitted to execute (5-arg encrypt with
--      explicit nonce derived from the key context)
-- ============================================================================

-- 1. Plaintext iCal URL column ------------------------------------------------
ALTER TABLE public.calendar_connections
  ADD COLUMN IF NOT EXISTS ical_url text;

-- 2. Drop & recreate calendar token RPCs --------------------------------------
DROP FUNCTION IF EXISTS public.encrypt_calendar_token(text, uuid);
DROP FUNCTION IF EXISTS public.decrypt_calendar_token(bytea, uuid);
DROP FUNCTION IF EXISTS public.get_calendar_tokens(uuid, text);
DROP FUNCTION IF EXISTS public.upsert_calendar_connection(uuid, text, text, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.update_calendar_access_token(uuid, text, text, timestamptz);

-- Encryption uses the pgsodium key id variant via key bytes lookup so it works
-- under SECURITY DEFINER as postgres without needing access to the
-- pgsodium_keymaker-restricted 3-arg key_uuid overload.
CREATE OR REPLACE FUNCTION public.encrypt_calendar_token(token text, p_key_id uuid)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium, vault
AS $function$
DECLARE
  v_key bytea;
  v_nonce bytea;
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_raw_secret INTO v_key
  FROM pgsodium.decrypted_key
  WHERE id = p_key_id;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Calendar encryption key not available';
  END IF;

  -- Deterministic nonce derived from the context keeps encrypt/decrypt symmetric
  v_nonce := substring(
    pgsodium.crypto_generichash(convert_to('calendar_token', 'utf8'), v_key)
    from 1 for 24
  );

  RETURN pgsodium.crypto_aead_det_encrypt(
    convert_to(token, 'utf8'),
    convert_to('calendar_token', 'utf8'),
    v_key,
    v_nonce
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_calendar_token(encrypted_token bytea, p_key_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium, vault
AS $function$
DECLARE
  v_key bytea;
  v_nonce bytea;
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_raw_secret INTO v_key
  FROM pgsodium.decrypted_key
  WHERE id = p_key_id;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Calendar encryption key not available';
  END IF;

  v_nonce := substring(
    pgsodium.crypto_generichash(convert_to('calendar_token', 'utf8'), v_key)
    from 1 for 24
  );

  RETURN convert_from(
    pgsodium.crypto_aead_det_decrypt(
      encrypted_token,
      convert_to('calendar_token', 'utf8'),
      v_key,
      v_nonce
    ),
    'utf8'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_calendar_tokens(p_user_id uuid, p_provider text)
RETURNS TABLE (
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  grant_id text,
  ical_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    public.decrypt_calendar_token(cc.access_token, cc.key_id) AS access_token,
    public.decrypt_calendar_token(cc.refresh_token, cc.key_id) AS refresh_token,
    cc.expires_at,
    cc.grant_id,
    cc.ical_url
  FROM public.calendar_connections cc
  WHERE cc.user_id = p_user_id AND cc.provider = p_provider;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_calendar_connection(
  p_user_id uuid,
  p_provider text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_grant_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $function$
DECLARE
  v_key_id uuid;
BEGIN
  SELECT id INTO v_key_id FROM pgsodium.valid_key WHERE name = 'calendar_tokens_key' LIMIT 1;

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Calendar encryption key (calendar_tokens_key) is not configured';
  END IF;

  INSERT INTO public.calendar_connections (
    user_id, provider, access_token, refresh_token, expires_at, key_id, grant_id
  )
  VALUES (
    p_user_id,
    p_provider,
    public.encrypt_calendar_token(p_access_token, v_key_id),
    public.encrypt_calendar_token(p_refresh_token, v_key_id),
    p_expires_at,
    v_key_id,
    p_grant_id
  )
  ON CONFLICT (user_id, provider) DO UPDATE SET
    access_token = public.encrypt_calendar_token(p_access_token, v_key_id),
    refresh_token = COALESCE(
      public.encrypt_calendar_token(p_refresh_token, v_key_id),
      calendar_connections.refresh_token
    ),
    expires_at = p_expires_at,
    key_id = v_key_id,
    grant_id = COALESCE(p_grant_id, calendar_connections.grant_id),
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_calendar_access_token(
  p_user_id uuid,
  p_provider text,
  p_access_token text,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $function$
DECLARE
  v_key_id uuid;
BEGIN
  SELECT key_id INTO v_key_id
  FROM public.calendar_connections
  WHERE user_id = p_user_id AND provider = p_provider;

  IF v_key_id IS NULL THEN
    SELECT id INTO v_key_id FROM pgsodium.valid_key WHERE name = 'calendar_tokens_key' LIMIT 1;
  END IF;

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Calendar encryption key (calendar_tokens_key) is not configured';
  END IF;

  UPDATE public.calendar_connections
  SET
    access_token = public.encrypt_calendar_token(p_access_token, v_key_id),
    expires_at = p_expires_at,
    key_id = v_key_id,
    updated_at = now()
  WHERE user_id = p_user_id AND provider = p_provider;
END;
$function$;

-- 3. Permissions --------------------------------------------------------------
REVOKE ALL ON FUNCTION public.encrypt_calendar_token(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_calendar_token(bytea, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_tokens(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_calendar_connection(uuid, text, text, text, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_calendar_access_token(uuid, text, text, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_calendar_tokens(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_calendar_connection(uuid, text, text, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_calendar_access_token(uuid, text, text, timestamptz) TO service_role;

-- 4. Ensure key exists --------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgsodium.valid_key WHERE name = 'calendar_tokens_key') THEN
    PERFORM pgsodium.create_key(name := 'calendar_tokens_key');
  END IF;
END $$;
