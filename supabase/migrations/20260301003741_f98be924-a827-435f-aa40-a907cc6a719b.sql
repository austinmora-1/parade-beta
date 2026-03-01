
-- Create a security definer function to remove both sides of a friendship
CREATE OR REPLACE FUNCTION public.remove_friendship(p_friendship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_friend_user_id uuid;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the friendship details, verify caller owns it
  SELECT user_id, friend_user_id
  INTO v_user_id, v_friend_user_id
  FROM friendships
  WHERE id = p_friendship_id AND user_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friendship not found or not owned by caller';
  END IF;

  -- Delete the caller's record
  DELETE FROM friendships WHERE id = p_friendship_id;

  -- Delete the reciprocal record (owned by the friend, pointing back to caller)
  IF v_friend_user_id IS NOT NULL THEN
    DELETE FROM friendships
    WHERE user_id = v_friend_user_id AND friend_user_id = v_caller_id;
  END IF;
END;
$$;
