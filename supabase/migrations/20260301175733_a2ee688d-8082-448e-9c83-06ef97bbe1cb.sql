-- Add end_date column for multi-day plans (nullable, single-day plans leave it null)
ALTER TABLE public.plans ADD COLUMN end_date timestamp with time zone DEFAULT NULL;