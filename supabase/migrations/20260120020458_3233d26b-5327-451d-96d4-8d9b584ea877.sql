-- Add grant_id column (safe if already exists)
ALTER TABLE public.calendar_connections
ADD COLUMN IF NOT EXISTS grant_id text;

-- Replace get_calendar_tokens with new return shape
DROP FUNCTION IF EXISTS public.get_calendar_tokens(uuid, text);
CREATE FUNCTION public.get_calendar_tokens(p_user_id uuid, p_provider text)
RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone, grant_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgsodium'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    public.decrypt_calendar_token(cc.access_token, cc.key_id) as access_token,
    public.decrypt_calendar_token(cc.refresh_token, cc.key_id) as refresh_token,
    cc.expires_at,
    cc.grant_id
  FROM public.calendar_connections cc
  WHERE cc.user_id = p_user_id AND cc.provider = p_provider;
END;
$function$;

-- Replace upsert_calendar_connection with new signature (add optional p_grant_id)
DROP FUNCTION IF EXISTS public.upsert_calendar_connection(uuid, text, text, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.upsert_calendar_connection(uuid, text, text, text, timestamp with time zone, text);
CREATE FUNCTION public.upsert_calendar_connection(
  p_user_id uuid,
  p_provider text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamp with time zone,
  p_grant_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgsodium'
AS $function$
DECLARE
  v_key_id uuid;
BEGIN
  SELECT id INTO v_key_id FROM pgsodium.valid_key WHERE name = 'calendar_tokens_key' LIMIT 1;
  
  INSERT INTO public.calendar_connections (user_id, provider, access_token, refresh_token, expires_at, key_id, grant_id)
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
    refresh_token = COALESCE(public.encrypt_calendar_token(p_refresh_token, v_key_id), calendar_connections.refresh_token),
    expires_at = p_expires_at,
    key_id = v_key_id,
    grant_id = COALESCE(p_grant_id, calendar_connections.grant_id),
    updated_at = now();
END;
$function$;