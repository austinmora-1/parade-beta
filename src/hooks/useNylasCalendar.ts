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

export function useNylasCalendar() {
  const { session } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lightweight status check - doesn't fetch events
  const checkConnection = useCallback(async () => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('nylas-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      
      setIsConnected(data.connected);
      setError(data.error || null);
    } catch (err) {
      console.error('Error checking Nylas connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to check connection');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = async (provider: 'google' | 'icloud' = 'google') => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase.functions.invoke('nylas-auth', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { provider },
      });

      if (error) throw error;

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error('Error connecting to Nylas:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  const disconnect = async () => {
    if (!session?.access_token) return;

    try {
      const { error } = await supabase.functions.invoke('nylas-disconnect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      
      setIsConnected(false);
      setEvents([]);
      setLastSyncResult(null);
      setError(null);
    } catch (err) {
      console.error('Error disconnecting from Nylas:', err);
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
      const { data, error } = await supabase.functions.invoke('nylas-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      
      // Check if we need to reconnect
      if (!data.synced && data.message?.includes('reconnect')) {
        setIsConnected(false);
        setError(data.message);
        return { synced: false, message: data.message };
      }

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

  const refreshEvents = async () => {
    if (!session?.access_token || !isConnected) return;

    try {
      const { data, error } = await supabase.functions.invoke('nylas-events', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      
      // Check if connection was lost
      if (!data.connected) {
        setIsConnected(false);
        setError(data.error || 'Connection lost');
        return;
      }

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
    recheckConnection: checkConnection,
  };
}
