-- Update the hang-request plan creation trigger to include source_timezone
CREATE OR REPLACE FUNCTION public.create_plans_on_hang_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recipient_name TEXT;
  v_sender_name TEXT;
  v_time_slot TEXT;
  v_plan_title_for_recipient TEXT;
  v_plan_title_for_sender TEXT;
  v_recipient_plan_id UUID;
  v_sender_plan_id UUID;
  v_plan_date TIMESTAMP WITH TIME ZONE;
  v_recipient_tz TEXT;
  v_sender_tz TEXT;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT display_name INTO v_recipient_name FROM public.profiles WHERE user_id = NEW.user_id;
    SELECT timezone INTO v_recipient_tz FROM public.profiles WHERE user_id = NEW.user_id;
    
    v_time_slot := REPLACE(NEW.selected_slot, '_', '-');
    v_plan_title_for_recipient := 'Hang with ' || NEW.requester_name;
    v_plan_title_for_sender := 'Hang with ' || COALESCE(v_recipient_name, 'a friend');
    v_plan_date := (NEW.selected_day::text || 'T12:00:00+00:00')::timestamp with time zone;

    INSERT INTO public.plans (user_id, title, activity, date, time_slot, duration, notes, source, source_timezone)
    VALUES (
      NEW.user_id, v_plan_title_for_recipient, 'other-events', v_plan_date,
      v_time_slot, 60, COALESCE(NEW.message, ''), 'hang-request', v_recipient_tz
    )
    RETURNING id INTO v_recipient_plan_id;

    IF NEW.sender_id IS NOT NULL THEN
      SELECT timezone INTO v_sender_tz FROM public.profiles WHERE user_id = NEW.sender_id;
      
      INSERT INTO public.plans (user_id, title, activity, date, time_slot, duration, notes, source, source_timezone)
      VALUES (
        NEW.sender_id, v_plan_title_for_sender, 'other-events', v_plan_date,
        v_time_slot, 60, COALESCE(NEW.message, ''), 'hang-request', v_sender_tz
      )
      RETURNING id INTO v_sender_plan_id;

      INSERT INTO public.plan_participants (plan_id, friend_id, status)
      VALUES (v_recipient_plan_id, NEW.sender_id, 'accepted');

      INSERT INTO public.plan_participants (plan_id, friend_id, status)
      VALUES (v_sender_plan_id, NEW.user_id, 'accepted');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;