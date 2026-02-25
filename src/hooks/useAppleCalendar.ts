import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SyncResult {
  synced: boolean;
  eventsProcessed?: number;
  datesUpdated?: number;
  message?: string;
}

export function useAppleCalendar() {
  const { session } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    try {
      // Check if an ical provider row exists in calendar_connections
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('id')
        .eq('provider', 'ical');

      if (error) throw error;
      setIsConnected(data && data.length > 0);
    } catch (err) {
      console.error('Error checking iCal connection:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connect = async (icalUrl: string) => {
    if (!session?.access_token) return;
    setIsConnecting(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('ical-connect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { icalUrl },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsConnected(true);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!session?.access_token) return;

    try {
      const { error } = await supabase.functions.invoke('ical-disconnect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      setIsConnected(false);
      setLastSyncResult(null);
    } catch (err) {
      console.error('Error disconnecting iCal:', err);
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
      const { data, error } = await supabase.functions.invoke('ical-sync', {
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
      const message = err instanceof Error ? err.message : 'Failed to sync';
      setError(message);
      return { synced: false, message };
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isConnected,
    isLoading,
    isSyncing,
    isConnecting,
    error,
    lastSyncResult,
    connect,
    disconnect,
    syncCalendar,
  };
}
