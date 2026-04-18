
CREATE OR REPLACE FUNCTION public.encrypt_calendar_token(token text, p_key_id uuid)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $function$
BEGIN
  IF token IS NULL THEN
    RETURN NULL;
  END IF;

  -- The 16 bytes of the key UUID are used as a deterministic nonce.
  RETURN pgsodium.crypto_aead_det_encrypt(
    convert_to(token, 'utf8'),
    convert_to('calendar_token', 'utf8'),
    p_key_id,
    decode(replace(p_key_id::text, '-', ''), 'hex')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_calendar_token(encrypted_token bytea, p_key_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $function$
BEGIN
  IF encrypted_token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN convert_from(
    pgsodium.crypto_aead_det_decrypt(
      encrypted_token,
      convert_to('calendar_token', 'utf8'),
      p_key_id,
      decode(replace(p_key_id::text, '-', ''), 'hex')
    ),
    'utf8'
  );
END;
$function$;
