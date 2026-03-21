DROP TRIGGER IF EXISTS on_profile_created_sync_loops ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_new_user_to_loops();