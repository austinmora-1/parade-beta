
-- Change access_token and refresh_token from bytea to text
-- First convert existing data, then alter column type
ALTER TABLE public.calendar_connections 
  ALTER COLUMN access_token TYPE text USING encode(access_token, 'escape'),
  ALTER COLUMN refresh_token TYPE text USING encode(refresh_token, 'escape');
