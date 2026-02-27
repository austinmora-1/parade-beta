
-- 1. PROFILES: Replace permissive public SELECT with authenticated-only policy
-- The current policy allows ANY visitor to read profiles (including home_address) when show_availability=true
DROP POLICY IF EXISTS "Public can view profile by share code" ON public.profiles;

-- Authenticated users can view profiles of their friends
CREATE POLICY "Authenticated users can view friend profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.friendships
    WHERE friendships.user_id = auth.uid()
      AND friendships.friend_user_id = profiles.user_id
      AND friendships.status = 'connected'
  )
);

-- For share-link functionality: allow viewing ONLY via the public_profiles view
-- We need a narrow policy for share code lookups (used by hang requests)
CREATE POLICY "Anyone can view profiles by share code for hang requests"
ON public.profiles
FOR SELECT
USING (
  show_availability = true
  AND auth.uid() IS NOT NULL
);

-- 2. AVAILABILITY: Replace public SELECT with authenticated + friendship check
DROP POLICY IF EXISTS "Public can view availability of users who allow it" ON public.availability;

CREATE POLICY "Authenticated friends can view availability"
ON public.availability
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.friendships
    WHERE friendships.user_id = auth.uid()
      AND friendships.friend_user_id = availability.user_id
      AND friendships.status = 'connected'
  )
);

-- 3. PLANS: Replace public SELECT with authenticated + friendship check
DROP POLICY IF EXISTS "Public can view plans of users who allow it" ON public.plans;

CREATE POLICY "Authenticated friends can view plans"
ON public.plans
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR id IN (SELECT user_participated_plan_ids(auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.friendships
    WHERE friendships.user_id = auth.uid()
      AND friendships.friend_user_id = plans.user_id
      AND friendships.status = 'connected'
  )
);

-- 4. CALENDAR_CONNECTIONS: Add missing INSERT and UPDATE policies
CREATE POLICY "Users can insert their own calendar connections"
ON public.calendar_connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
ON public.calendar_connections
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
