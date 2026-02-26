import { useMemo, useState, useEffect, useCallback } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useNotifications() {
  const { friends } = usePlannerStore();
  const { user } = useAuth();
  const [pendingHangRequestsCount, setPendingHangRequestsCount] = useState(0);
  const [pendingPlanInvitesCount, setPendingPlanInvitesCount] = useState(0);
  const [pendingChangeRequestsCount, setPendingChangeRequestsCount] = useState(0);

  const fetchPendingHangs = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('hang_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('user_id', user.id);
    setPendingHangRequestsCount(count ?? 0);
  }, [user]);

  const fetchPendingPlanInvites = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('plan_participants')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', user.id)
      .eq('status', 'invited');
    setPendingPlanInvitesCount(count ?? 0);
  }, [user]);

  const fetchPendingChangeRequests = useCallback(async () => {
    if (!user) return;
    // Count change requests where I have a pending response
    const { data: pendingResponses } = await supabase
      .from('plan_change_responses')
      .select('id')
      .eq('participant_id', user.id)
      .eq('response', 'pending');
    setPendingChangeRequestsCount(pendingResponses?.length ?? 0);
  }, [user]);

  useEffect(() => {
    fetchPendingHangs();
    fetchPendingPlanInvites();
    fetchPendingChangeRequests();
  }, [fetchPendingHangs, fetchPendingPlanInvites, fetchPendingChangeRequests]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('hang-requests-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hang_requests', filter: `user_id=eq.${user.id}` },
        () => { fetchPendingHangs(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plan_participants', filter: `friend_id=eq.${user.id}` },
        () => { fetchPendingPlanInvites(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plan_change_responses', filter: `participant_id=eq.${user.id}` },
        () => { fetchPendingChangeRequests(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchPendingHangs, fetchPendingPlanInvites, fetchPendingChangeRequests]);

  const incomingRequestsCount = useMemo(() => {
    return friends.filter(f => f.status === 'pending' && f.isIncoming).length;
  }, [friends]);

  const totalNotifications = incomingRequestsCount + pendingHangRequestsCount + pendingPlanInvitesCount + pendingChangeRequestsCount;

  return {
    incomingRequestsCount,
    pendingHangRequestsCount,
    pendingPlanInvitesCount,
    pendingChangeRequestsCount,
    totalNotifications,
    refetchHangRequests: fetchPendingHangs,
    refetchPlanInvites: fetchPendingPlanInvites,
    refetchChangeRequests: fetchPendingChangeRequests,
  };
}
