-- Convert calendar_connections token columns from text to bytea so encrypted values store correctly.
-- Existing rows had encryption fail, so any existing token data is invalid and can be dropped.

ALTER TABLE public.calendar_connections
  ALTER COLUMN access_token DROP DEFAULT,
  ALTER COLUMN refresh_token DROP DEFAULT;

-- Wipe any existing rows because their tokens are corrupt/invalid (cast text->bytea would not be decryptable).
DELETE FROM public.calendar_connections;

ALTER TABLE public.calendar_connections
  ALTER COLUMN access_token TYPE bytea USING NULL,
  ALTER COLUMN refresh_token TYPE bytea USING NULL;