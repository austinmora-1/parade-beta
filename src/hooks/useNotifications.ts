import { useMemo, useState, useEffect, useCallback } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useNotifications() {
  const { friends } = usePlannerStore();
  const { user } = useAuth();
  const [pendingHangRequestsCount, setPendingHangRequestsCount] = useState(0);

  const fetchPendingHangs = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('hang_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('user_id', user.id);
    setPendingHangRequestsCount(count ?? 0);
  }, [user]);

  useEffect(() => {
    fetchPendingHangs();
  }, [fetchPendingHangs]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('hang-requests-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hang_requests', filter: `user_id=eq.${user.id}` },
        () => { fetchPendingHangs(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchPendingHangs]);

  const incomingRequestsCount = useMemo(() => {
    return friends.filter(f => f.status === 'pending' && f.isIncoming).length;
  }, [friends]);

  const totalNotifications = incomingRequestsCount + pendingHangRequestsCount;

  return {
    incomingRequestsCount,
    pendingHangRequestsCount,
    totalNotifications,
    refetchHangRequests: fetchPendingHangs,
  };
}
