
CREATE TABLE public.weekly_intentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  social_energy TEXT,
  target_hangouts INTEGER,
  vibes TEXT[] DEFAULT '{}'::text[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_intentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own intentions"
ON public.weekly_intentions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own intentions"
ON public.weekly_intentions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intentions"
ON public.weekly_intentions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own intentions"
ON public.weekly_intentions FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_weekly_intentions_updated_at
BEFORE UPDATE ON public.weekly_intentions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
