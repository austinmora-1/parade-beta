import { useMemo, useEffect, useCallback, useSyncExternalStore } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

  // Count dismissed items per category to subtract from badge
  const dismissed = state.dismissedIds;
  const dismissedFriendCount = useMemo(() => {
    return friends.filter(f => f.status === 'pending' && f.isIncoming && dismissed.has(`friend-${f.id}`)).length;
  }, [friends, dismissed]);

  // We can't know exact dismissed IDs for count-based queries, so we count by prefix
  const dismissedHangCount = useMemo(() => [...dismissed].filter(id => id.startsWith('hang-')).length, [dismissed]);
  const dismissedInviteCount = useMemo(() => [...dismissed].filter(id => id.startsWith('invite-')).length, [dismissed]);
  const dismissedChangeCount = useMemo(() => [...dismissed].filter(id => id.startsWith('change-')).length, [dismissed]);
  const dismissedPhotoCount = useMemo(() => [...dismissed].filter(id => id.startsWith('photo-')).length, [dismissed]);

  const effectiveHangCount = Math.max(0, state.pendingHangRequestsCount - dismissedHangCount);
  const effectiveInviteCount = Math.max(0, state.pendingPlanInvitesCount - dismissedInviteCount);
  const effectiveChangeCount = Math.max(0, state.pendingChangeRequestsCount - dismissedChangeCount);
  const effectivePhotoCount = Math.max(0, state.newPlanPhotosCount - dismissedPhotoCount);
  const effectiveFriendCount = Math.max(0, incomingRequestsCount - dismissedFriendCount);

  const totalNotifications = effectiveFriendCount + effectiveHangCount + effectiveInviteCount + effectiveChangeCount + effectivePhotoCount;

  // Sync PWA app badge with notification count
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
    dismissedIds: state.dismissedIds,
    totalNotifications,
    dismissNotification,
    refetchHangRequests: fetchPendingHangs,
    refetchPlanInvites: fetchPendingPlanInvites,
    refetchChangeRequests: fetchPendingChangeRequests,
    refetchPlanPhotos: fetchNewPlanPhotos,
  };
}
