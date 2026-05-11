CREATE OR REPLACE FUNCTION public._tmp_export_auth_users()
RETURNS SETOF auth.users
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT * FROM auth.users;
$$;

REVOKE ALL ON FUNCTION public._tmp_export_auth_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tmp_export_auth_users() TO service_role;