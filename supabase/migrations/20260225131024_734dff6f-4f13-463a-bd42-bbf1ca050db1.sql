
-- Trigger: when availability row for today is inserted/updated, sync location_status to profiles
CREATE OR REPLACE FUNCTION public.sync_availability_location_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only sync if the availability date is today
  IF NEW.date = CURRENT_DATE THEN
    UPDATE public.profiles
    SET 
      location_status = COALESCE(NEW.location_status, 'home'),
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_availability_location_to_profile_trigger
AFTER INSERT OR UPDATE OF location_status ON public.availability
FOR EACH ROW
EXECUTE FUNCTION public.sync_availability_location_to_profile();
