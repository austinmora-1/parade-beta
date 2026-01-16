-- Add RLS policy to allow public viewing of plans for users who allow sharing
-- This uses the same show_availability setting from profiles

CREATE POLICY "Public can view plans of users who allow it" 
ON public.plans 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = plans.user_id 
    AND profiles.show_availability = true
  )
);