
-- Add start_time and end_time columns to plans
ALTER TABLE public.plans
ADD COLUMN start_time time without time zone,
ADD COLUMN end_time time without time zone;
