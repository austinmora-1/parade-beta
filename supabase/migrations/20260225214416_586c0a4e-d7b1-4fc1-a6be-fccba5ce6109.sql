
-- When a new user signs up, check if anyone invited them by email.
-- If so, link the friendship record and create a reciprocal friendship.
CREATE OR REPLACE FUNCTION public.link_invited_friends_on_signup()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_new_user_name TEXT;
BEGIN
  -- Get the new user's display name
  v_new_user_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email);

  -- Find all friendship records where someone invited this email
  FOR r IN
    SELECT id, user_id, friend_name
    FROM public.friendships
    WHERE friend_email = NEW.email
      AND status = 'invited'
      AND friend_user_id IS NULL
  LOOP
    -- Update the existing invitation to connected
    UPDATE public.friendships
    SET friend_user_id = NEW.id,
        status = 'connected',
        updated_at = now()
    WHERE id = r.id;

    -- Create the reciprocal friendship (new user -> inviter)
    INSERT INTO public.friendships (user_id, friend_user_id, friend_name, friend_email, status)
    SELECT NEW.id, r.user_id, p.display_name, NULL, 'connected'
    FROM public.profiles p
    WHERE p.user_id = r.user_id
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Attach to auth.users AFTER INSERT (same pattern as handle_new_user)
CREATE TRIGGER on_auth_user_created_link_friends
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_invited_friends_on_signup();
