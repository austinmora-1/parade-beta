import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
}

interface SyncResult {
  synced: boolean;
  eventsProcessed?: number;
  datesUpdated?: number;
  message?: string;
}

export function useGoogleCalendar() {
  const { session } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      
      setIsConnected(data.connected);
      if (data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Error checking calendar connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to check connection');
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = async () => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      if (data.authUrl) {
        // Direct navigation instead of popup for better Safari compatibility
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error('Error connecting to Google Calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  const disconnect = async () => {
    if (!session?.access_token) return;

    try {
      const { error } = await supabase.functions.invoke('google-calendar-disconnect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      
      setIsConnected(false);
      setEvents([]);
      setLastSyncResult(null);
    } catch (err) {
      console.error('Error disconnecting from Google Calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const syncCalendar = async (): Promise<SyncResult> => {
    if (!session?.access_token || !isConnected) {
      return { synced: false, message: 'Not connected' };
    }

    setIsSyncing(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });

      if (error) throw error;
      
      const result: SyncResult = {
        synced: data.synced,
        eventsProcessed: data.eventsProcessed,
        datesUpdated: data.datesUpdated,
        message: data.message,
      };
      
      setLastSyncResult(result);
      return result;
    } catch (err) {
      console.error('Error syncing calendar:', err);
      const message = err instanceof Error ? err.message : 'Failed to sync';
      setError(message);
      return { synced: false, message };
    } finally {
      setIsSyncing(false);
    }
  };

  const refreshEvents = async (timeMin?: string, timeMax?: string) => {
    if (!session?.access_token || !isConnected) return;

    try {
      const params = new URLSearchParams();
      if (timeMin) params.set('timeMin', timeMin);
      if (timeMax) params.set('timeMax', timeMax);

      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      
      if (data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    }
  };

  return {
    isConnected,
    isLoading,
    isSyncing,
    events,
    error,
    lastSyncResult,
    connect,
    disconnect,
    syncCalendar,
    refreshEvents,
  };
}
