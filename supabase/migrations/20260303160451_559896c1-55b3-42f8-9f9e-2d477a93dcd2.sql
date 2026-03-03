
-- Create pods table
CREATE TABLE public.pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'My Pod',
  emoji text DEFAULT '💜',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create pod_members junction table
CREATE TABLE public.pod_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  friend_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pod_id, friend_user_id)
);

-- Enable RLS
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_members ENABLE ROW LEVEL SECURITY;

-- Pods RLS: users manage their own pods
CREATE POLICY "Users can view their own pods" ON public.pods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own pods" ON public.pods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pods" ON public.pods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pods" ON public.pods FOR DELETE USING (auth.uid() = user_id);

-- Pod members RLS: users manage members of their own pods
CREATE POLICY "Users can view members of their pods" ON public.pod_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.pods WHERE pods.id = pod_members.pod_id AND pods.user_id = auth.uid()));
CREATE POLICY "Users can add members to their pods" ON public.pod_members FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.pods WHERE pods.id = pod_members.pod_id AND pods.user_id = auth.uid()));
CREATE POLICY "Users can remove members from their pods" ON public.pod_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.pods WHERE pods.id = pod_members.pod_id AND pods.user_id = auth.uid()));

-- Updated_at trigger for pods
CREATE TRIGGER update_pods_updated_at BEFORE UPDATE ON public.pods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing pod members: create a "My Pod" for each user who has pod members
INSERT INTO public.pods (user_id, name, emoji, sort_order)
SELECT DISTINCT user_id, 'My Pod', '💜', 0
FROM public.friendships
WHERE is_pod_member = true AND friend_user_id IS NOT NULL;

-- Insert existing pod members into the new pod_members table
INSERT INTO public.pod_members (pod_id, friend_user_id)
SELECT p.id, f.friend_user_id
FROM public.friendships f
JOIN public.pods p ON p.user_id = f.user_id AND p.name = 'My Pod'
WHERE f.is_pod_member = true AND f.friend_user_id IS NOT NULL
ON CONFLICT DO NOTHING;
