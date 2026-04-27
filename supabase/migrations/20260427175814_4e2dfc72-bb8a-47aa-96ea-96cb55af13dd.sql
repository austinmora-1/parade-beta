-- Function to backfill availability rows for all users for a 6-month rolling window
-- based on each user's default work days/hours and default availability status.
CREATE OR REPLACE FUNCTION public.backfill_availability_for_user(_user_id uuid, _days_ahead int DEFAULT 183)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile RECORD;
  _date date;
  _start date := CURRENT_DATE;
  _end date := CURRENT_DATE + _days_ahead;
  _dow_name text;
  _is_workday boolean;
  _default_free boolean;
  _early_morning boolean;
  _late_morning boolean;
  _early_afternoon boolean;
  _late_afternoon boolean;
  _evening boolean;
  _late_night boolean;
  _ws numeric;
  _we numeric;
  _inserted int := 0;
BEGIN
  SELECT
    COALESCE(default_work_days, ARRAY['monday','tuesday','wednesday','thursday','friday']) AS work_days,
    COALESCE(default_work_start_hour, 9) AS work_start,
    COALESCE(default_work_end_hour, 17) AS work_end,
    COALESCE(default_availability_status, 'free') AS default_status
  INTO _profile
  FROM profiles
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  _default_free := _profile.default_status <> 'unavailable';
  _ws := _profile.work_start;
  _we := _profile.work_end;

  _date := _start;
  WHILE _date <= _end LOOP
    _dow_name := lower(to_char(_date, 'FMday'));
    _is_workday := _dow_name = ANY(_profile.work_days);

    -- Slot ranges: EM 6-9, LM 9-12, EA 12-15, LA 15-18, EV 18-22, LN 22-26
    _early_morning   := _default_free;
    _late_morning    := _default_free;
    _early_afternoon := _default_free;
    _late_afternoon  := _default_free;
    _evening         := _default_free;
    _late_night      := _default_free;

    IF _is_workday THEN
      IF 6  < _we AND 9  > _ws THEN _early_morning   := false; END IF;
      IF 9  < _we AND 12 > _ws THEN _late_morning    := false; END IF;
      IF 12 < _we AND 15 > _ws THEN _early_afternoon := false; END IF;
      IF 15 < _we AND 18 > _ws THEN _late_afternoon  := false; END IF;
      IF 18 < _we AND 22 > _ws THEN _evening         := false; END IF;
      IF 22 < _we AND 26 > _ws THEN _late_night      := false; END IF;
    END IF;

    INSERT INTO availability (
      user_id, date,
      early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night,
      location_status
    )
    VALUES (
      _user_id, _date,
      _early_morning, _late_morning, _early_afternoon, _late_afternoon, _evening, _late_night,
      'home'
    )
    ON CONFLICT (user_id, date) DO NOTHING;

    IF FOUND THEN
      _inserted := _inserted + 1;
    END IF;

    _date := _date + 1;
  END LOOP;

  RETURN _inserted;
END;
$$;

-- Function to backfill availability for ALL users (used by daily cron)
CREATE OR REPLACE FUNCTION public.backfill_availability_for_all_users(_days_ahead int DEFAULT 183)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user RECORD;
  _total int := 0;
BEGIN
  FOR _user IN SELECT user_id FROM profiles LOOP
    _total := _total + COALESCE(public.backfill_availability_for_user(_user.user_id, _days_ahead), 0);
  END LOOP;
  RETURN _total;
END;
$$;

-- Trigger function: when a new profile is created, seed availability rows
CREATE OR REPLACE FUNCTION public.seed_availability_on_profile_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.backfill_availability_for_user(NEW.user_id, 183);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_availability_on_profile_create ON public.profiles;
CREATE TRIGGER trg_seed_availability_on_profile_create
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.seed_availability_on_profile_create();