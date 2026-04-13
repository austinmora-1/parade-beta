-- Fix Kristen Lowe's display_name that was overwritten to null during onboarding
UPDATE profiles
SET display_name = 'Kristen Lowe', updated_at = now()
WHERE user_id = '21af98f8-17a5-492f-8572-ac04d49ad554' AND display_name IS NULL;

-- Fix stale friend_name in Logan's friendship record
UPDATE friendships
SET friend_name = 'Kristen Lowe', updated_at = now()
WHERE friend_user_id = '21af98f8-17a5-492f-8572-ac04d49ad554' AND friend_name IN ('User', 'Someone', 'user', 'someone');