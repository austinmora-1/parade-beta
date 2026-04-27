DO $$
BEGIN
  PERFORM cron.unschedule('daily-availability-backfill')
  FROM cron.job
  WHERE jobname = 'daily-availability-backfill';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-availability-backfill',
  '0 5 * * *',
  $$SELECT public.backfill_availability_for_all_users(183);$$
);