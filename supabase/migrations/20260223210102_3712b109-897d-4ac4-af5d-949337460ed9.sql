
-- Add source and source_event_id columns to plans to track imported events
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS source_event_id text DEFAULT NULL;

-- Index for efficient lookup during sync
CREATE INDEX IF NOT EXISTS idx_plans_source_event ON public.plans (user_id, source, source_event_id);
