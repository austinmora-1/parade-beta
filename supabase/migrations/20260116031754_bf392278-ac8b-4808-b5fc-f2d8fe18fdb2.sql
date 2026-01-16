-- Create hang_requests table to store incoming hang requests
CREATE TABLE public.hang_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  share_code TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT,
  message TEXT,
  selected_day DATE NOT NULL,
  selected_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hang_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own hang requests
CREATE POLICY "Users can view their own hang requests"
ON public.hang_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own hang requests (accept/decline)
CREATE POLICY "Users can update their own hang requests"
ON public.hang_requests
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own hang requests
CREATE POLICY "Users can delete their own hang requests"
ON public.hang_requests
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_hang_requests_updated_at
BEFORE UPDATE ON public.hang_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();