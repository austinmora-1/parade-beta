import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { addDays, isAfter, isBefore, startOfDay } from 'date-fns';

export interface LiveLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  label: string | null;
  updated_at: string;
}

export function useLiveLocation() {
  const { user } = useAuth();
  const [isSharing, setIsSharing] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[] | null>(null);
  const [friendLocations, setFriendLocations] = useState<LiveLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const { plans, friends } = usePlannerStore();

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

  // Fetch friend locations
  const fetchFriendLocations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('live_locations')
      .select('user_id, latitude, longitude, accuracy, label, updated_at')
      .neq('user_id', user.id);
    if (data) {
      setFriendLocations(data as LiveLocation[]);
    }
  }, [user]);

  // Subscribe to realtime friend location updates
  useEffect(() => {
    if (!user) return;
    fetchFriendLocations();
    const channel = supabase
      .channel('live-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations' }, () => {
        fetchFriendLocations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchFriendLocations]);

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
            watchIdRef.current = navigator.geolocation.watchPosition(
              async (p) => {
                await supabase
                  .from('live_locations')
                  .update({
                    latitude: p.coords.latitude,
                    longitude: p.coords.longitude,
                    accuracy: p.coords.accuracy,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('user_id', user.id);
              },
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
  }, [user]);

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
    suggestedFriendIds, startSharing, stopSharing, updateSharedWith,
  };
}
