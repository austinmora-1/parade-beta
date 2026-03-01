import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePlannerStore } from '@/stores/plannerStore';

export function useFriendRequestNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { loadAllData } = usePlannerStore();

  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up friend request notifications for user:', user.id);

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
          console.log('New friend request received:', payload);
          
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
          loadAllData();
        }
      )
      .subscribe((status) => {
        console.log('Friend request subscription status:', status);
      });

    return () => {
      console.log('Cleaning up friend request notifications');
      supabase.removeChannel(channel);
    };
  }, [user?.id, toast, loadAllData]);
}
