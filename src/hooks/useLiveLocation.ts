import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { addDays, addHours, isAfter, isBefore, startOfDay } from 'date-fns';

export interface LiveLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  label: string | null;
  updated_at: string;
}

const GPS_WRITE_THROTTLE_MS = 30_000; // 30 seconds between GPS writes
const POLL_INTERVAL_MS = 30_000; // Poll friend locations every 30 seconds

export function useLiveLocation() {
  const { user } = useAuth();
  const [isSharing, setIsSharing] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[] | null>(null);
  const [friendLocations, setFriendLocations] = useState<LiveLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastWriteRef = useRef<number>(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { plans, friends } = usePlannerStore();

  // Get connected friend user IDs for scoped queries
  const connectedFriendIds = useMemo(() => {
    return friends
      .filter(f => f.status === 'connected' && f.friendUserId)
      .map(f => f.friendUserId!);
  }, [friends]);

  // Check if user has any plan starting within the next 1 hour
  const hasUpcomingPlanSoon = useMemo(() => {
    const now = new Date();
    const oneHourOut = addHours(now, 1);
    return plans.some(plan => {
      const planDate = new Date(plan.date);
      return !isBefore(planDate, now) && !isAfter(planDate, oneHourOut);
    });
  }, [plans]);

  // Suggest friends from upcoming shared plans (next 2 days)
  const suggestedFriendIds = useMemo(() => {
    if (!user) return [];
    const now = startOfDay(new Date());
    const limit = addDays(now, 2);
    const ids = new Set<string>();

    for (const plan of plans) {
      if (isBefore(plan.date, now) || isAfter(plan.date, limit)) continue;
      for (const p of plan.participants) {
        if (p.friendUserId && p.friendUserId !== user.id && p.role !== 'subscriber') {
          ids.add(p.friendUserId);
        }
      }
    }
    return Array.from(ids);
  }, [plans, user]);

  // Check if currently sharing
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from('live_locations')
        .select('id, expires_at, shared_with')
        .eq('user_id', user.id)
        .single();
      if (data && new Date(data.expires_at) > new Date()) {
        setIsSharing(true);
        setSharedWith(data.shared_with as string[] | null);
      }
    };
    check();
  }, [user]);

  // Fetch friend locations — scoped to connected friends only
  const fetchFriendLocations = useCallback(async () => {
    if (!user || connectedFriendIds.length === 0) {
      setFriendLocations([]);
      return;
    }
    const { data } = await supabase
      .from('live_locations')
      .select('user_id, latitude, longitude, accuracy, label, updated_at')
      .in('user_id', connectedFriendIds);
    if (data) {
      setFriendLocations(data as LiveLocation[]);
    }
  }, [user, connectedFriendIds]);

  // Poll friend locations instead of realtime subscription
  useEffect(() => {
    if (!user || connectedFriendIds.length === 0) return;

    fetchFriendLocations();
    pollIntervalRef.current = setInterval(fetchFriendLocations, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user, connectedFriendIds, fetchFriendLocations]);

  // Throttled GPS write
  const writeLocation = useCallback(async (coords: GeolocationCoordinates) => {
    if (!user) return;
    const now = Date.now();
    if (now - lastWriteRef.current < GPS_WRITE_THROTTLE_MS) return;
    lastWriteRef.current = now;

    await supabase
      .from('live_locations')
      .update({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
  }, [user]);

  const startSharing = useCallback(async (selectedIds: string[] | null) => {
    if (!user || !navigator.geolocation) return false;
    setIsLoading(true);

    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { error } = await supabase
            .from('live_locations')
            .upsert({
              user_id: user.id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              shared_with: selectedIds,
              updated_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
            }, { onConflict: 'user_id' });

          if (!error) {
            setIsSharing(true);
            setSharedWith(selectedIds);
            lastWriteRef.current = Date.now();
            watchIdRef.current = navigator.geolocation.watchPosition(
              (p) => writeLocation(p.coords),
              () => {},
              { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
            );
          }
          setIsLoading(false);
          resolve(!error);
        },
        () => {
          setIsLoading(false);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, [user, writeLocation]);

  const updateSharedWith = useCallback(async (selectedIds: string[] | null) => {
    if (!user) return;
    await supabase
      .from('live_locations')
      .update({ shared_with: selectedIds })
      .eq('user_id', user.id);
    setSharedWith(selectedIds);
  }, [user]);

  const stopSharing = useCallback(async () => {
    if (!user) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    await supabase
      .from('live_locations')
      .delete()
      .eq('user_id', user.id);
    setIsSharing(false);
    setSharedWith(null);
  }, [user]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    isSharing, isLoading, sharedWith, friendLocations,
    suggestedFriendIds, hasUpcomingPlanSoon, startSharing, stopSharing, updateSharedWith,
  };
}
