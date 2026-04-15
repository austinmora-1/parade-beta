-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- D.1: Materialized view for profile lookups
CREATE MATERIALIZED VIEW IF NOT EXISTS public.profile_cache AS
  SELECT user_id, display_name, avatar_url, home_address, timezone
  FROM public.profiles;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_cache_user ON public.profile_cache (user_id);

-- Schedule concurrent refresh every 5 minutes
SELECT cron.schedule(
  'refresh-profile-cache',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.profile_cache$$
);

-- D.2: Database trigger for plan invite notifications
CREATE OR REPLACE FUNCTION public.notify_plan_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_plan RECORD;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Only fire for new invitations
  IF NEW.status = 'invited' THEN
    -- Look up the plan details
    SELECT id, user_id, title INTO v_plan
    FROM public.plans
    WHERE id = NEW.plan_id;

    IF FOUND THEN
      -- Get config from Supabase env
      v_supabase_url := current_setting('supabase.url', true);
      v_service_key := current_setting('supabase.service_role_key', true);

      -- If settings aren't available via current_setting, try env-based approach
      IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
        RETURN NEW;  -- Gracefully skip if config not available
      END IF;

      PERFORM extensions.http_post(
        url := v_supabase_url || '/functions/v1/on-plan-created',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_service_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'plan_id', v_plan.id::text,
          'creator_id', v_plan.user_id::text,
          'participant_ids', jsonb_build_array(NEW.friend_id::text),
          'plan_title', v_plan.title
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to plan_participants
CREATE TRIGGER trg_notify_plan_invite
  AFTER INSERT ON public.plan_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_plan_invite();