
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

  SELECT decrypted_raw_key INTO v_key
  FROM pgsodium.decrypted_key
  WHERE id = p_key_id;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Calendar encryption key not available';
  END IF;

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

  SELECT decrypted_raw_key INTO v_key
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
