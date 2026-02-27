
-- Fix profiles RLS policies: wrap auth.uid() with (select auth.uid())
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING ((select auth.uid()) = user_id);

-- Fix friendships RLS policies
DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships" ON public.friendships
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;
CREATE POLICY "Users can create friendships" ON public.friendships
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own friendships" ON public.friendships;
CREATE POLICY "Users can update their own friendships" ON public.friendships
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update received friend requests" ON public.friendships;
CREATE POLICY "Users can update received friend requests" ON public.friendships
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friendships;
CREATE POLICY "Users can delete their own friendships" ON public.friendships
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Fix weekend_availability RLS policies (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekend_availability') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert their own availability" ON public.weekend_availability';
    EXECUTE 'CREATE POLICY "Users can insert their own availability" ON public.weekend_availability FOR INSERT WITH CHECK ((select auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own availability" ON public.weekend_availability';
    EXECUTE 'CREATE POLICY "Users can update their own availability" ON public.weekend_availability FOR UPDATE USING ((select auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own availability" ON public.weekend_availability';
    EXECUTE 'CREATE POLICY "Users can delete their own availability" ON public.weekend_availability FOR DELETE USING ((select auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "Users can view own and friends availability" ON public.weekend_availability';
    EXECUTE 'CREATE POLICY "Users can view own and friends availability" ON public.weekend_availability FOR SELECT USING (((select auth.uid()) = user_id) OR (EXISTS (SELECT 1 FROM friendships WHERE friendships.user_id = (select auth.uid()) AND friendships.friend_user_id = weekend_availability.user_id AND friendships.status = ''connected'')))';
  END IF;
END $$;
