-- Revoke API access to profile_cache - it's only for internal RPC use
REVOKE ALL ON public.profile_cache FROM anon, authenticated;