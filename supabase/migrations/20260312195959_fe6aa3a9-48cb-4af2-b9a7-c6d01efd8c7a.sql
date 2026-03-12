
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Create trigger function to sync new users to Loops
CREATE OR REPLACE FUNCTION public.sync_new_user_to_loops()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  supabase_url TEXT;
  anon_key TEXT;
BEGIN
  -- Get config from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- If settings aren't available, use the known project URL
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://womtzaraskisayzskafe.supabase.co';
  END IF;

  IF anon_key IS NULL OR anon_key = '' THEN
    anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvbXR6YXJhc2tpc2F5enNrYWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjc5MzQsImV4cCI6MjA4MjcwMzkzNH0.xZ51OcyUp33XPm0BbgwNou0nLqWXZ0rzM9q9JeppW-c';
  END IF;

  -- Make async HTTP call to the edge function
  PERFORM extensions.http_post(
    url := supabase_url || '/functions/v1/sync-user-to-loops',
    body := json_build_object('user_id', NEW.user_id)::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    )::jsonb
  );

  RETURN NEW;
END;
$$;

-- Create trigger on profiles table for new inserts
DROP TRIGGER IF EXISTS on_profile_created_sync_loops ON public.profiles;
CREATE TRIGGER on_profile_created_sync_loops
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_new_user_to_loops();
