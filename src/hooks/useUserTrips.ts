import { useCallback, useEffect, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserTrip {
  id: string;
  name: string | null;
  location: string | null;
  start_date: string; // 'yyyy-MM-dd'
  end_date: string;   // 'yyyy-MM-dd'
  priority_friend_ids: string[];
  available_slots: string[];
}

const TRIPS_UPDATED_EVENT = 'trips:updated';

/**
 * Fetches the current user's upcoming/ongoing trips (end_date >= today).
 * Listens for the global `trips:updated` event so updates from elsewhere
 * (TripsList, GuidedTripSheet) propagate automatically.
 */
export function useUserTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('trips')
      .select('id, name, location, start_date, end_date, priority_friend_ids, available_slots')
      .eq('user_id', user.id)
      .gte('end_date', today)
      .order('start_date', { ascending: true });

    if (!error && data) setTrips(data as UserTrip[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => { void refresh(); };
    window.addEventListener(TRIPS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(TRIPS_UPDATED_EVENT, handler);
  }, [refresh]);

  return { trips, loading, refresh };
}
