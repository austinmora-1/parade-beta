CREATE OR REPLACE FUNCTION public.sync_friend_name_on_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name AND NEW.display_name IS NOT NULL THEN
    UPDATE public.friendships
    SET friend_name = NEW.display_name, updated_at = now()
    WHERE friend_user_id = NEW.user_id
      AND friend_name IS DISTINCT FROM NEW.display_name;
  END IF;
  RETURN NEW;
END;
$function$;