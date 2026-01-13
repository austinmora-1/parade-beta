-- Plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  activity TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  time_slot TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plans"
ON public.plans FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plans"
ON public.plans FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans"
ON public.plans FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plans"
ON public.plans FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Plan participants (junction table for plans and friends)
CREATE TABLE public.plan_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants of their plans"
ON public.plan_participants FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_participants.plan_id AND plans.user_id = auth.uid()));

CREATE POLICY "Users can add participants to their plans"
ON public.plan_participants FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_participants.plan_id AND plans.user_id = auth.uid()));

CREATE POLICY "Users can remove participants from their plans"
ON public.plan_participants FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_participants.plan_id AND plans.user_id = auth.uid()));

-- Friendships table
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_user_id UUID,
  friend_name TEXT NOT NULL,
  friend_email TEXT,
  status TEXT NOT NULL DEFAULT 'invited',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friendships"
ON public.friendships FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create friendships"
ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friendships"
ON public.friendships FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own friendships"
ON public.friendships FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_friendships_updated_at
BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Availability table
CREATE TABLE public.availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  early_morning BOOLEAN DEFAULT true,
  late_morning BOOLEAN DEFAULT true,
  early_afternoon BOOLEAN DEFAULT true,
  late_afternoon BOOLEAN DEFAULT true,
  evening BOOLEAN DEFAULT true,
  late_night BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own availability"
ON public.availability FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own availability"
ON public.availability FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own availability"
ON public.availability FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own availability"
ON public.availability FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_availability_updated_at
BEFORE UPDATE ON public.availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add vibe and location to profiles (current status)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_vibe TEXT,
ADD COLUMN IF NOT EXISTS location_status TEXT DEFAULT 'home';