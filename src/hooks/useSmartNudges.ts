import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  const { data: nudges = [], isLoading } = useQuery({
    queryKey: ['smart-nudges', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('smart_nudges')
        .select('id, nudge_type, friend_user_id, title, message, metadata, created_at, expires_at')
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .is('acted_on_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data) return [];

      const now = new Date().toISOString();
      return (data as SmartNudge[]).filter(n => !n.expires_at || n.expires_at > now);
    },
    enabled: !!user,
  });

  const dismissNudge = useCallback(async (nudgeId: string) => {
    queryClient.setQueryData(['smart-nudges', user?.id], (old: SmartNudge[] | undefined) =>
      (old || []).filter(n => n.id !== nudgeId)
    );
    await supabase
      .from('smart_nudges')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', nudgeId);
  }, [user?.id, queryClient]);

  const markActedOn = useCallback(async (nudgeId: string) => {
    queryClient.setQueryData(['smart-nudges', user?.id], (old: SmartNudge[] | undefined) =>
      (old || []).filter(n => n.id !== nudgeId)
    );
    await supabase
      .from('smart_nudges')
      .update({ acted_on_at: new Date().toISOString() })
      .eq('id', nudgeId);
  }, [user?.id, queryClient]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['smart-nudges', user?.id] });
  }, [user?.id, queryClient]);

  return { nudges, isLoading, dismissNudge, markActedOn, refetch };
}
