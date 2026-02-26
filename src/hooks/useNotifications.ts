import { useMemo, useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Shared state so every component using useNotifications sees the same counts
let sharedState = {
  pendingHangRequestsCount: 0,
  pendingPlanInvitesCount: 0,
  pendingChangeRequestsCount: 0,
  newPlanPhotosCount: 0,
};
let listeners = new Set<() => void>();

function emitChange() {
  sharedState = { ...sharedState };
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return sharedState;
}

export function useNotifications() {
  const { friends } = usePlannerStore();
  const { user } = useAuth();

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const fetchPendingHangs = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('hang_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('user_id', user.id);
    sharedState = { ...sharedState, pendingHangRequestsCount: count ?? 0 };
    emitChange();
  }, [user]);

  const fetchPendingPlanInvites = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('plan_participants')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', user.id)
      .eq('status', 'invited');
    sharedState = { ...sharedState, pendingPlanInvitesCount: count ?? 0 };
    emitChange();
  }, [user]);

  const fetchPendingChangeRequests = useCallback(async () => {
    if (!user) return;
    const { data: pendingResponses } = await supabase
      .from('plan_change_responses')
      .select('id')
      .eq('participant_id', user.id)
      .eq('response', 'pending');
    sharedState = { ...sharedState, pendingChangeRequestsCount: pendingResponses?.length ?? 0 };
    emitChange();
  }, [user]);

  const fetchNewPlanPhotos = useCallback(async () => {
    if (!user) return;
    // Count photos added by others to plans user owns or participates in, from last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('plan_photos')
      .select('*', { count: 'exact', head: true })
      .neq('uploaded_by', user.id)
      .gte('created_at', oneDayAgo);
    sharedState = { ...sharedState, newPlanPhotosCount: count ?? 0 };
    emitChange();
  }, [user]);

  useEffect(() => {
    fetchPendingHangs();
    fetchPendingPlanInvites();
    fetchPendingChangeRequests();
    fetchNewPlanPhotos();
  }, [fetchPendingHangs, fetchPendingPlanInvites, fetchPendingChangeRequests, fetchNewPlanPhotos]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-shared')
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'plan_photos' },
        () => { fetchNewPlanPhotos(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchPendingHangs, fetchPendingPlanInvites, fetchPendingChangeRequests, fetchNewPlanPhotos]);

  const incomingRequestsCount = useMemo(() => {
    return friends.filter(f => f.status === 'pending' && f.isIncoming).length;
  }, [friends]);

  const totalNotifications = incomingRequestsCount + state.pendingHangRequestsCount + state.pendingPlanInvitesCount + state.pendingChangeRequestsCount + state.newPlanPhotosCount;

  return {
    incomingRequestsCount,
    pendingHangRequestsCount: state.pendingHangRequestsCount,
    pendingPlanInvitesCount: state.pendingPlanInvitesCount,
    pendingChangeRequestsCount: state.pendingChangeRequestsCount,
    newPlanPhotosCount: state.newPlanPhotosCount,
    totalNotifications,
    refetchHangRequests: fetchPendingHangs,
    refetchPlanInvites: fetchPendingPlanInvites,
    refetchChangeRequests: fetchPendingChangeRequests,
    refetchPlanPhotos: fetchNewPlanPhotos,
  };
}
