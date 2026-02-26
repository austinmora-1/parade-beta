-- Add status column to plans table (confirmed or tentative)
ALTER TABLE public.plans 
ADD COLUMN status text NOT NULL DEFAULT 'confirmed';

-- Add a comment for clarity
COMMENT ON COLUMN public.plans.status IS 'Plan status: confirmed (blocks availability) or tentative (does not block availability)';