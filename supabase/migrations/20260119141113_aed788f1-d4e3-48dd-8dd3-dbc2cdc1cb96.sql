-- Create a security definer function to check if a user owns a share code
CREATE OR REPLACE FUNCTION public.owns_share_code(p_share_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE share_code = p_share_code
      AND user_id = auth.uid()
  )
$$;

-- Add policy so users can also view hang requests sent TO them (via share_code)
CREATE POLICY "Users can view hang requests sent to them"
ON public.hang_requests
FOR SELECT
USING (public.owns_share_code(share_code));