
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_friendship_id uuid, p_requester_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_accepter_id uuid;
  v_requester_name text;
  v_accepter_name text;
BEGIN
  v_accepter_id := auth.uid();
  IF v_accepter_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify this is a pending request sent TO the current user
  IF NOT EXISTS (
    SELECT 1 FROM friendships
    WHERE id = p_friendship_id
      AND friend_user_id = v_accepter_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Friend request not found or not pending';
  END IF;

  -- Update the sender's original record to connected
  UPDATE friendships
  SET status = 'connected', updated_at = now()
  WHERE id = p_friendship_id;

  -- Get names for the reciprocal record
  SELECT display_name INTO v_requester_name FROM profiles WHERE user_id = p_requester_user_id;
  SELECT display_name INTO v_accepter_name FROM profiles WHERE user_id = v_accepter_id;

  -- Create reciprocal friendship for the accepter (if not exists)
  INSERT INTO friendships (user_id, friend_user_id, friend_name, status)
  VALUES (v_accepter_id, p_requester_user_id, COALESCE(v_requester_name, 'Friend'), 'connected')
  ON CONFLICT DO NOTHING;

  -- Also update sender's record friend_name in case it was stale
  UPDATE friendships
  SET friend_name = COALESCE(v_accepter_name, friend_name), updated_at = now()
  WHERE user_id = p_requester_user_id AND friend_user_id = v_accepter_id AND status = 'pending';

  -- Mark any remaining pending record from sender -> accepter as connected too
  UPDATE friendships
  SET status = 'connected', updated_at = now()
  WHERE user_id = p_requester_user_id AND friend_user_id = v_accepter_id AND status = 'pending';
END;
$$;
