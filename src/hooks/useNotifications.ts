import { useMemo } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';

export function useNotifications() {
  const { friends } = usePlannerStore();

  const incomingRequestsCount = useMemo(() => {
    return friends.filter(f => f.status === 'pending' && f.isIncoming).length;
  }, [friends]);

  const totalNotifications = incomingRequestsCount;

  return {
    incomingRequestsCount,
    totalNotifications,
  };
}
