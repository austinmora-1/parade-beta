-- Function to get decrypted calendar tokens (only callable by service role)
CREATE OR REPLACE FUNCTION public.get_calendar_tokens(p_user_id uuid, p_provider text)
RETURNS TABLE(
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    public.decrypt_calendar_token(cc.access_token, cc.key_id) as access_token,
    public.decrypt_calendar_token(cc.refresh_token, cc.key_id) as refresh_token,
    cc.expires_at
  FROM public.calendar_connections cc
  WHERE cc.user_id = p_user_id AND cc.provider = p_provider;
END;
$$;

-- Revoke access from public users
REVOKE ALL ON FUNCTION public.get_calendar_tokens(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_tokens(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_calendar_tokens(uuid, text) FROM authenticated;

-- Function to upsert calendar connection with encryption
CREATE OR REPLACE FUNCTION public.upsert_calendar_connection(
  p_user_id uuid,
  p_provider text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id uuid;
BEGIN
  SELECT id INTO v_key_id FROM pgsodium.valid_key WHERE name = 'calendar_tokens_key' LIMIT 1;
  
  INSERT INTO public.calendar_connections (user_id, provider, access_token, refresh_token, expires_at, key_id)
  VALUES (
    p_user_id,
    p_provider,
    public.encrypt_calendar_token(p_access_token, v_key_id),
    public.encrypt_calendar_token(p_refresh_token, v_key_id),
    p_expires_at,
    v_key_id
  )
  ON CONFLICT (user_id, provider) DO UPDATE SET
    access_token = public.encrypt_calendar_token(p_access_token, v_key_id),
    refresh_token = COALESCE(public.encrypt_calendar_token(p_refresh_token, v_key_id), calendar_connections.refresh_token),
    expires_at = p_expires_at,
    key_id = v_key_id,
    updated_at = now();
END;
$$;

-- Revoke access from public users
REVOKE ALL ON FUNCTION public.upsert_calendar_connection(uuid, text, text, text, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_calendar_connection(uuid, text, text, text, timestamp with time zone) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_calendar_connection(uuid, text, text, text, timestamp with time zone) FROM authenticated;

-- Function to update access token with encryption
CREATE OR REPLACE FUNCTION public.update_calendar_access_token(
  p_user_id uuid,
  p_provider text,
  p_access_token text,
  p_expires_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id uuid;
BEGIN
  SELECT key_id INTO v_key_id FROM public.calendar_connections 
  WHERE user_id = p_user_id AND provider = p_provider;
  
  UPDATE public.calendar_connections
  SET 
    access_token = public.encrypt_calendar_token(p_access_token, v_key_id),
    expires_at = p_expires_at,
    updated_at = now()
  WHERE user_id = p_user_id AND provider = p_provider;
END;
$$;

-- Revoke access from public users
REVOKE ALL ON FUNCTION public.update_calendar_access_token(uuid, text, text, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_calendar_access_token(uuid, text, text, timestamp with time zone) FROM anon;
REVOKE ALL ON FUNCTION public.update_calendar_access_token(uuid, text, text, timestamp with time zone) FROM authenticated;