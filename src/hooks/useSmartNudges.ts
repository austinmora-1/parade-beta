import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SmartNudge {
  id: string;
  nudge_type: string;
  friend_user_id: string | null;
  title: string;
  message: string;
  metadata: Record<string, any>;
  created_at: string;
  expires_at: string | null;
}

export function useSmartNudges() {
  const { user } = useAuth();
  const [nudges, setNudges] = useState<SmartNudge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNudges = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('smart_nudges')
      .select('id, nudge_type, friend_user_id, title, message, metadata, created_at, expires_at')
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .is('acted_on_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      // Filter out expired nudges client-side as well
      const now = new Date().toISOString();
      setNudges(
        (data as SmartNudge[]).filter(n => !n.expires_at || n.expires_at > now)
      );
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNudges();
  }, [fetchNudges]);

  const dismissNudge = useCallback(async (nudgeId: string) => {
    setNudges(prev => prev.filter(n => n.id !== nudgeId));
    await supabase
      .from('smart_nudges')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', nudgeId);
  }, []);

  const markActedOn = useCallback(async (nudgeId: string) => {
    setNudges(prev => prev.filter(n => n.id !== nudgeId));
    await supabase
      .from('smart_nudges')
      .update({ acted_on_at: new Date().toISOString() })
      .eq('id', nudgeId);
  }, []);

  return { nudges, isLoading, dismissNudge, markActedOn, refetch: fetchNudges };
}
