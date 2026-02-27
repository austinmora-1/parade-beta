
-- Table to track which plan reminders have already been sent
CREATE TABLE public.plan_reminders_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(plan_id, user_id)
);

-- Enable RLS
ALTER TABLE public.plan_reminders_sent ENABLE ROW LEVEL SECURITY;

-- Only service role needs access (cron job), but add a SELECT policy for users
CREATE POLICY "Users can view their own reminders"
  ON public.plan_reminders_sent
  FOR SELECT
  USING (auth.uid() = user_id);

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
