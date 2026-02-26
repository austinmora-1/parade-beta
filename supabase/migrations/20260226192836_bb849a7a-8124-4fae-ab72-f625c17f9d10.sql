
-- Create plan_photos table
CREATE TABLE public.plan_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_photos ENABLE ROW LEVEL SECURITY;

-- Plan owners can manage photos
CREATE POLICY "Plan owners can manage photos"
  ON public.plan_photos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM plans WHERE plans.id = plan_photos.plan_id AND plans.user_id = auth.uid()
  ));

-- Plan participants can view photos
CREATE POLICY "Plan participants can view photos"
  ON public.plan_photos FOR SELECT
  USING (plan_id IN (SELECT user_participated_plan_ids(auth.uid())));

-- Plan participants can insert photos
CREATE POLICY "Plan participants can insert photos"
  ON public.plan_photos FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by AND (
      EXISTS (SELECT 1 FROM plans WHERE plans.id = plan_photos.plan_id AND plans.user_id = auth.uid())
      OR plan_id IN (SELECT user_participated_plan_ids(auth.uid()))
    )
  );

-- Plan participants can delete their own photos
CREATE POLICY "Users can delete their own photos"
  ON public.plan_photos FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_photos;

-- Create storage bucket for plan photos
INSERT INTO storage.buckets (id, name, public) VALUES ('plan-photos', 'plan-photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload plan photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'plan-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view plan photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'plan-photos');

CREATE POLICY "Users can delete their own plan photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'plan-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
