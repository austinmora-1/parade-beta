import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePlannerStore } from '@/stores/plannerStore';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { supabase } from '@/integrations/supabase/client';
import { formatDisplayName } from '@/lib/formatName';

export function useFriendRequestNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { loadFriends } = usePlannerStore();

  useRealtimeHub(
    'friendships',
    'INSERT',
    async (payload) => {
      const newRequest = payload.new as {
        id: string;
        friend_name: string;
        user_id: string;
        status: string;
      };

      const { data: profiles } = await supabase
        .rpc('get_display_names_for_users', { p_user_ids: [newRequest.user_id] });

      const p = (profiles as any)?.[0];
      const requesterName = p ? formatDisplayName({ firstName: p.first_name, lastName: p.last_name, displayName: p.display_name }) : 'Someone';

      toast({
        title: 'New Friend Request! 🎉',
        description: `${requesterName} wants to connect with you`,
      });

      loadFriends();
    },
    user ? `friend_user_id=eq.${user.id}` : undefined,
  );
}
