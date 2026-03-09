
-- Function to get availability by share code (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.get_availability_by_share_code(
  p_share_code text,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  date date,
  early_morning boolean,
  late_morning boolean,
  early_afternoon boolean,
  late_afternoon boolean,
  evening boolean,
  late_night boolean,
  location_status text,
  trip_location text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.date,
    a.early_morning,
    a.late_morning,
    a.early_afternoon,
    a.late_afternoon,
    a.evening,
    a.late_night,
    a.location_status,
    a.trip_location
  FROM public.availability a
  JOIN public.profiles p ON p.user_id = a.user_id
  WHERE p.share_code = p_share_code
    AND p.show_availability = true
    AND a.date >= p_start_date
    AND a.date <= p_end_date
  ORDER BY a.date;
$$;

-- Function to get plans by share code (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.get_plans_by_share_code(
  p_share_code text,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE(
  id uuid,
  title text,
  activity text,
  date timestamptz,
  time_slot text,
  duration integer,
  location text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    pl.id,
    pl.title,
    pl.activity,
    pl.date,
    pl.time_slot,
    pl.duration,
    pl.location
  FROM public.plans pl
  JOIN public.profiles p ON p.user_id = pl.user_id
  WHERE p.share_code = p_share_code
    AND p.show_availability = true
    AND pl.date >= p_start_date
    AND pl.date <= p_end_date
  ORDER BY pl.date;
$$;
