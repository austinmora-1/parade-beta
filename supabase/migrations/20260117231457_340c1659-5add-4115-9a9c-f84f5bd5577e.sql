-- Add RLS policy for users to see incoming friend requests (where they are the friend_user_id)
CREATE POLICY "Users can view incoming friend requests" 
ON public.friendships 
FOR SELECT 
USING (auth.uid() = friend_user_id);

-- Enable realtime for friendships table
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;