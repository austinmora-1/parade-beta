
-- Table to store recurring plan templates
CREATE TABLE public.recurring_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  activity TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  feed_visibility TEXT NOT NULL DEFAULT 'private',
  source_timezone TEXT,
  
  -- Recurrence rule fields
  frequency TEXT NOT NULL DEFAULT 'weekly', -- 'weekly', 'biweekly', 'monthly'
  day_of_week INTEGER, -- 0=Sunday, 1=Monday, ... 6=Saturday (for weekly/biweekly)
  week_of_month INTEGER, -- 1-5 for monthly (e.g. 1 = first Thursday)
  
  -- Lifecycle
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on DATE, -- NULL = no end
  max_occurrences INTEGER, -- NULL = unlimited
  last_generated_date DATE, -- track how far ahead we've generated
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add recurring_plan_id to plans table to link generated instances
ALTER TABLE public.plans ADD COLUMN recurring_plan_id UUID REFERENCES public.recurring_plans(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.recurring_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own recurring plans"
  ON public.recurring_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recurring plans"
  ON public.recurring_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring plans"
  ON public.recurring_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring plans"
  ON public.recurring_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_recurring_plans_updated_at
  BEFORE UPDATE ON public.recurring_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
