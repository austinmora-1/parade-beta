-- Add plan_id and trip_id to open_invites
ALTER TABLE public.open_invites
  ADD COLUMN plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  ADD COLUMN trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_open_invites_plan_id ON public.open_invites(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_open_invites_trip_id ON public.open_invites(trip_id) WHERE trip_id IS NOT NULL;

-- Validation trigger: ensure plan/trip referenced is owned by the invite creator
CREATE OR REPLACE FUNCTION public.validate_open_invite_anchor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.plans WHERE id = NEW.plan_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'plan_id must reference a plan owned by the invite creator';
    END IF;
  END IF;
  IF NEW.trip_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trips WHERE id = NEW.trip_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'trip_id must reference a trip owned by the invite creator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_open_invite_anchor_trigger ON public.open_invites;
CREATE TRIGGER validate_open_invite_anchor_trigger
  BEFORE INSERT OR UPDATE ON public.open_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_open_invite_anchor();