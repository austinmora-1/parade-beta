import { useMemo, useState, useEffect } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useNotifications() {
  const { friends } = usePlannerStore();
  const { user } = useAuth();
  const [pendingHangRequestsCount, setPendingHangRequestsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchPendingHangs = async () => {
      const { count } = await supabase
        .from('hang_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingHangRequestsCount(count ?? 0);
    };
    fetchPendingHangs();
  }, [user]);

  const incomingRequestsCount = useMemo(() => {
    return friends.filter(f => f.status === 'pending' && f.isIncoming).length;
  }, [friends]);

  const totalNotifications = incomingRequestsCount + pendingHangRequestsCount;

  return {
    incomingRequestsCount,
    pendingHangRequestsCount,
    totalNotifications,
  };
}
