import { useMemo, useEffect, useCallback, useSyncExternalStore } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';

const DISMISSED_KEY = 'notifications_dismissed';

function loadDismissedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
  } catch { return new Set(); }
}

function saveDismissedIds(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

// Shared state so every component using useNotifications sees the same counts
let sharedState = {
  pendingHangRequestsCount: 0,
  pendingPlanInvitesCount: 0,
  pendingChangeRequestsCount: 0,
  newPlanPhotosCount: 0,
  pendingParticipantRequestsCount: 0,
  pendingTripProposalsCount: 0,
  dismissedIds: loadDismissedIds(),
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

export function dismissNotification(id: string) {
  const next = new Set(sharedState.dismissedIds);
  next.add(id);
  sharedState = { ...sharedState, dismissedIds: next };
  saveDismissedIds(next);
  emitChange();
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
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('plan_photos')
      .select('*', { count: 'exact', head: true })
      .neq('uploaded_by', user.id)
      .gte('created_at', oneDayAgo);
    sharedState = { ...sharedState, newPlanPhotosCount: count ?? 0 };
    emitChange();
  }, [user]);

  const fetchPendingParticipantRequests = useCallback(async () => {
    if (!user) return;
    const { data: ownedPlans } = await supabase
      .from('plans')
      .select('id')
      .eq('user_id', user.id);
    if (!ownedPlans || ownedPlans.length === 0) {
      sharedState = { ...sharedState, pendingParticipantRequestsCount: 0 };
      emitChange();
      return;
    }
    const planIds = ownedPlans.map(p => p.id);
    const { count } = await supabase
      .from('plan_participant_requests' as any)
      .select('*', { count: 'exact', head: true })
      .in('plan_id', planIds)
      .eq('status', 'pending');
    sharedState = { ...sharedState, pendingParticipantRequestsCount: count ?? 0 };
    emitChange();
  }, [user]);

  const fetchPendingTripProposals = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('trip_participants')
      .select('*, trips!inner(status)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'invited')
      .eq('trips.status', 'proposal');
    sharedState = { ...sharedState, pendingTripProposalsCount: count ?? 0 };
    emitChange();
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchPendingHangs();
    fetchPendingPlanInvites();
    fetchPendingChangeRequests();
    fetchNewPlanPhotos();
    fetchPendingParticipantRequests();
    fetchPendingTripProposals();
  }, [fetchPendingHangs, fetchPendingPlanInvites, fetchPendingChangeRequests, fetchNewPlanPhotos, fetchPendingParticipantRequests, fetchPendingTripProposals]);

  // Visibility-aware polling: 30s when active, 2min when tab is hidden
  useEffect(() => {
    const refetchAll = () => {
      fetchPendingHangs();
      fetchPendingPlanInvites();
      fetchPendingChangeRequests();
      fetchNewPlanPhotos();
      fetchPendingParticipantRequests();
      fetchPendingTripProposals();
    };

    let timer: ReturnType<typeof setInterval>;

    const startPolling = () => {
      clearInterval(timer);
      const interval = document.hidden ? 120_000 : 30_000;
      timer = setInterval(refetchAll, interval);
    };

    const handleVisibility = () => startPolling();

    document.addEventListener('visibilitychange', handleVisibility);
    startPolling();

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchPendingHangs, fetchPendingPlanInvites, fetchPendingChangeRequests, fetchNewPlanPhotos, fetchPendingParticipantRequests, fetchPendingTripProposals]);

  // Use shared realtime hub instead of dedicated channel
  useRealtimeHub('hang_requests', '*', () => fetchPendingHangs(), user ? `user_id=eq.${user.id}` : undefined);
  useRealtimeHub('plan_participants', '*', () => fetchPendingPlanInvites(), user ? `friend_id=eq.${user.id}` : undefined);
  useRealtimeHub('plan_change_responses', '*', () => fetchPendingChangeRequests(), user ? `participant_id=eq.${user.id}` : undefined);
  useRealtimeHub('plan_photos', 'INSERT', () => fetchNewPlanPhotos());
  useRealtimeHub('trip_participants', '*', () => fetchPendingTripProposals(), user ? `user_id=eq.${user.id}` : undefined);

  const incomingRequestsCount = useMemo(() => {
    return friends.filter(f => f.status === 'pending' && f.isIncoming).length;
  }, [friends]);

  const dismissed = state.dismissedIds;
  const dismissedFriendCount = useMemo(() => {
    return friends.filter(f => f.status === 'pending' && f.isIncoming && dismissed.has(`friend-${f.id}`)).length;
  }, [friends, dismissed]);

  const dismissedHangCount = useMemo(() => [...dismissed].filter(id => id.startsWith('hang-')).length, [dismissed]);
  const dismissedInviteCount = useMemo(() => [...dismissed].filter(id => id.startsWith('invite-')).length, [dismissed]);
  const dismissedChangeCount = useMemo(() => [...dismissed].filter(id => id.startsWith('change-')).length, [dismissed]);
  const dismissedPhotoCount = useMemo(() => [...dismissed].filter(id => id.startsWith('photo-')).length, [dismissed]);
  const dismissedParticipantReqCount = useMemo(() => [...dismissed].filter(id => id.startsWith('participant-req-')).length, [dismissed]);
  const dismissedTripProposalCount = useMemo(() => [...dismissed].filter(id => id.startsWith('trip-proposal-')).length, [dismissed]);

  const effectiveHangCount = Math.max(0, state.pendingHangRequestsCount - dismissedHangCount);
  const effectiveInviteCount = Math.max(0, state.pendingPlanInvitesCount - dismissedInviteCount);
  const effectiveChangeCount = Math.max(0, state.pendingChangeRequestsCount - dismissedChangeCount);
  const effectivePhotoCount = Math.max(0, state.newPlanPhotosCount - dismissedPhotoCount);
  const effectiveFriendCount = Math.max(0, incomingRequestsCount - dismissedFriendCount);
  const effectiveParticipantReqCount = Math.max(0, state.pendingParticipantRequestsCount - dismissedParticipantReqCount);
  const effectiveTripProposalCount = Math.max(0, state.pendingTripProposalsCount - dismissedTripProposalCount);

  const totalNotifications = effectiveFriendCount + effectiveHangCount + effectiveInviteCount + effectiveChangeCount + effectivePhotoCount + effectiveParticipantReqCount + effectiveTripProposalCount;

  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (totalNotifications > 0) {
        navigator.setAppBadge(totalNotifications).catch(() => {});
      } else {
        navigator.clearAppBadge?.().catch(() => {});
      }
    }
  }, [totalNotifications]);

  return {
    incomingRequestsCount,
    pendingHangRequestsCount: state.pendingHangRequestsCount,
    pendingPlanInvitesCount: state.pendingPlanInvitesCount,
    pendingChangeRequestsCount: state.pendingChangeRequestsCount,
    newPlanPhotosCount: state.newPlanPhotosCount,
    pendingParticipantRequestsCount: state.pendingParticipantRequestsCount,
    pendingTripProposalsCount: state.pendingTripProposalsCount,
    dismissedIds: state.dismissedIds,
    totalNotifications,
    dismissNotification,
    refetchHangRequests: fetchPendingHangs,
    refetchPlanInvites: fetchPendingPlanInvites,
    refetchChangeRequests: fetchPendingChangeRequests,
    refetchPlanPhotos: fetchNewPlanPhotos,
    refetchParticipantRequests: fetchPendingParticipantRequests,
    refetchTripProposals: fetchPendingTripProposals,
  };
}
