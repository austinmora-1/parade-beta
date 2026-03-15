
-- Part 1a: Document proposed status
COMMENT ON COLUMN public.plans.status IS 'Valid values: confirmed | tentative | cancelled | proposed';

-- Part 1b: Add proposed_by column
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS proposed_by UUID DEFAULT NULL;

COMMENT ON COLUMN public.plans.proposed_by IS 'User ID of the person who sent this as a proposal. NULL for self-created plans.';

-- Part 1e: Add indexes for proposed plan lookups
CREATE INDEX IF NOT EXISTS idx_plans_proposed_by
ON public.plans (proposed_by)
WHERE status = 'proposed';

CREATE INDEX IF NOT EXISTS idx_plans_status_participant
ON public.plan_participants (friend_id, plan_id);
