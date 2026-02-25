
-- Create a function that auto-creates plans for both users when a hang request is accepted
CREATE OR REPLACE FUNCTION public.create_plans_on_hang_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recipient_name TEXT;
  v_sender_name TEXT;
  v_time_slot TEXT;
  v_plan_title_for_recipient TEXT;
  v_plan_title_for_sender TEXT;
  v_recipient_plan_id UUID;
  v_sender_plan_id UUID;
BEGIN
  -- Only fire when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    
    -- Get recipient display name
    SELECT display_name INTO v_recipient_name
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    -- Convert selected_slot format (early_morning -> early-morning) for plans table
    v_time_slot := REPLACE(NEW.selected_slot, '_', '-');

    -- Build plan titles
    v_plan_title_for_recipient := 'Hang with ' || NEW.requester_name;
    v_plan_title_for_sender := 'Hang with ' || COALESCE(v_recipient_name, 'a friend');

    -- Create plan for recipient (the user who accepted)
    INSERT INTO public.plans (user_id, title, activity, date, time_slot, duration, notes, source)
    VALUES (
      NEW.user_id,
      v_plan_title_for_recipient,
      'other-events',
      NEW.selected_day::timestamp with time zone,
      v_time_slot,
      60,
      COALESCE(NEW.message, ''),
      'hang-request'
    )
    RETURNING id INTO v_recipient_plan_id;

    -- Create plan for sender (if sender_id exists - registered user)
    IF NEW.sender_id IS NOT NULL THEN
      INSERT INTO public.plans (user_id, title, activity, date, time_slot, duration, notes, source)
      VALUES (
        NEW.sender_id,
        v_plan_title_for_sender,
        'other-events',
        NEW.selected_day::timestamp with time zone,
        v_time_slot,
        60,
        COALESCE(NEW.message, ''),
        'hang-request'
      )
      RETURNING id INTO v_sender_plan_id;

      -- Add each user as a participant on the other's plan
      -- Sender is a participant on recipient's plan
      INSERT INTO public.plan_participants (plan_id, friend_id, status)
      VALUES (v_recipient_plan_id, NEW.sender_id, 'accepted');

      -- Recipient is a participant on sender's plan  
      INSERT INTO public.plan_participants (plan_id, friend_id, status)
      VALUES (v_sender_plan_id, NEW.user_id, 'accepted');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_hang_request_accepted
  AFTER UPDATE ON public.hang_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_plans_on_hang_accepted();
