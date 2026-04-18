
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

  -- Derive a deterministic 24-byte nonce from the key UUID bytes (no extra
  -- pgsodium calls required). We pad/truncate the 16-byte uuid + an 8-byte
  -- fixed suffix to reach the required nonce length.
  v_nonce := decode(replace(p_key_id::text, '-', ''), 'hex')
             || E'\\x6361666573757078'::bytea; -- "cafesupx" filler

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

  v_nonce := decode(replace(p_key_id::text, '-', ''), 'hex')
             || E'\\x6361666573757078'::bytea;

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
