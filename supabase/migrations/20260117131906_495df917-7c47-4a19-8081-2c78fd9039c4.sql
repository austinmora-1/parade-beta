-- Add location_status column to availability table for per-day location tracking
ALTER TABLE public.availability 
ADD COLUMN location_status text DEFAULT 'home';