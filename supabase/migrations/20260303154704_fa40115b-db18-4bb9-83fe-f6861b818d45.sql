
-- First clean up any remaining duplicates (keep the highest-priority status record)
DELETE FROM friendships f1
USING friendships f2
WHERE f1.user_id = f2.user_id
  AND f1.friend_user_id = f2.friend_user_id
  AND f1.friend_user_id IS NOT NULL
  AND f1.id != f2.id
  AND (
    -- Keep the one with higher status priority (connected > pending > invited)
    CASE f1.status WHEN 'connected' THEN 3 WHEN 'pending' THEN 2 WHEN 'invited' THEN 1 ELSE 0 END
    < CASE f2.status WHEN 'connected' THEN 3 WHEN 'pending' THEN 2 WHEN 'invited' THEN 1 ELSE 0 END
    -- If same status, keep the older one
    OR (f1.status = f2.status AND f1.created_at > f2.created_at)
  );

-- Add unique constraint (only for non-null friend_user_id)
CREATE UNIQUE INDEX idx_friendships_unique_user_friend 
ON friendships (user_id, friend_user_id) 
WHERE friend_user_id IS NOT NULL;
