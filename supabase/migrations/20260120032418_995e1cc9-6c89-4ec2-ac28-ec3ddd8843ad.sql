
-- Create a separate protected table for hang request emails
CREATE TABLE public.hang_request_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hang_request_id uuid NOT NULL REFERENCES public.hang_requests(id) ON DELETE CASCADE,
    requester_email text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(hang_request_id)
);

-- Enable RLS
ALTER TABLE public.hang_request_emails ENABLE ROW LEVEL SECURITY;

-- Only the recipient (owner of the share_code) can view emails
CREATE POLICY "Only recipients can view requester emails"
ON public.hang_request_emails
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.hang_requests hr
        WHERE hr.id = hang_request_emails.hang_request_id
        AND owns_share_code(hr.share_code)
    )
);

-- Migrate existing emails to the new table
INSERT INTO public.hang_request_emails (hang_request_id, requester_email)
SELECT id, requester_email FROM public.hang_requests
WHERE requester_email IS NOT NULL;

-- Remove the email column from hang_requests (it will no longer be exposed via share_code access)
ALTER TABLE public.hang_requests DROP COLUMN requester_email;
