import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface EventSuggestion {
  emoji: string;
  title: string;
  description: string;
  friend_names: string[];
  day: string;
  time_slot: string;
}

export function useEventSuggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!user || isLoading) return;
    setIsLoading(true);

    try {
      // Get user's location for weather
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          // Location not available, proceed without weather
        }
      }

      const { data, error } = await supabase.functions.invoke('event-suggestions', {
        body: { latitude, longitude },
      });

      if (error) throw error;
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [user, isLoading]);

  // Auto-fetch once on mount
  useEffect(() => {
    if (user && !hasFetched) {
      fetchSuggestions();
    }
  }, [user, hasFetched]);

  return { suggestions, isLoading, refresh: fetchSuggestions };
}
