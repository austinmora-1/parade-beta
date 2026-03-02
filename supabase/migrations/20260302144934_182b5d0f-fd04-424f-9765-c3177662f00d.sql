-- Store the timezone of the plan creator so shared plans can be converted for participants
ALTER TABLE public.plans ADD COLUMN source_timezone text DEFAULT NULL;