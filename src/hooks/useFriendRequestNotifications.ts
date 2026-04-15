import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePlannerStore } from '@/stores/plannerStore';

export function useFriendRequestNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { loadFriends } = usePlannerStore();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('friend-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friendships',
          filter: `friend_user_id=eq.${user.id}`,
        },
        async (payload) => {
          
          
          const newRequest = payload.new as {
            id: string;
            friend_name: string;
            user_id: string;
            status: string;
          };

          // Use RPC to get the requester's name (works even for non-discoverable users)
          const { data: profiles } = await supabase
            .rpc('get_display_names_for_users', { p_user_ids: [newRequest.user_id] });

          const requesterName = (profiles as any)?.[0]?.display_name || 'Someone';

          toast({
            title: 'New Friend Request! 🎉',
            description: `${requesterName} wants to connect with you`,
          });

          // Reload friends data to show the new request
          loadFriends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, toast, loadFriends]);
}
