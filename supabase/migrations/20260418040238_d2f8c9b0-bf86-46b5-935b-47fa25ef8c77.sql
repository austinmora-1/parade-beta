
-- Grant postgres (the SECURITY DEFINER owner) execute on the pgsodium overloads
-- that take a key uuid + nonce. These are the variants currently granted only
-- to pgsodium_keymaker / service_role.
GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_encrypt(bytea, bytea, uuid, bytea) TO postgres;
GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_decrypt(bytea, bytea, uuid, bytea) TO postgres;

-- Also keep service_role explicitly granted in case ownership changes later.
GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_encrypt(bytea, bytea, uuid, bytea) TO service_role;
GRANT EXECUTE ON FUNCTION pgsodium.crypto_aead_det_decrypt(bytea, bytea, uuid, bytea) TO service_role;

CREATE OR REPLACE FUNCTION public.encrypt_calendar_token(token text, p_key_id uuid)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $function$
DECLARE
  v_nonce bytea;
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;

  v_nonce := substring(
    pgsodium.crypto_generichash(convert_to(p_key_id::text, 'utf8'))
    from 1 for 24
  );

  RETURN pgsodium.crypto_aead_det_encrypt(
    convert_to(token, 'utf8'),
    convert_to('calendar_token', 'utf8'),
    p_key_id,
    v_nonce
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_calendar_token(encrypted_token bytea, p_key_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $function$
DECLARE
  v_nonce bytea;
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;

  v_nonce := substring(
    pgsodium.crypto_generichash(convert_to(p_key_id::text, 'utf8'))
    from 1 for 24
  );

  RETURN convert_from(
    pgsodium.crypto_aead_det_decrypt(
      encrypted_token,
      convert_to('calendar_token', 'utf8'),
      p_key_id,
      v_nonce
    ),
    'utf8'
  );
END;
$function$;
