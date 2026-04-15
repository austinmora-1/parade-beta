import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type RealtimeHandler = (payload: any) => void;

interface Registration {
  table: string;
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
  handler: RealtimeHandler;
}

// Singleton state
let channel: ReturnType<typeof supabase.channel> | null = null;
let currentUserId: string | null = null;
let registrations: Registration[] = [];
let refCount = 0;

function rebuildChannel(userId: string) {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  currentUserId = userId;

  // Deduplicate by table+event+filter to avoid duplicate postgres_changes subscriptions
  const seen = new Set<string>();
  const uniqueRegistrations: Registration[] = [];

  for (const reg of registrations) {
    const key = `${reg.table}:${reg.event}:${reg.filter || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRegistrations.push(reg);
    }
  }

  const ch = supabase.channel(`hub-${userId}`);

  for (const reg of uniqueRegistrations) {
    const config: any = {
      event: reg.event,
      schema: 'public',
      table: reg.table,
    };
    if (reg.filter) config.filter = reg.filter;

    ch.on('postgres_changes', config, (payload: any) => {
      // Dispatch to ALL handlers matching this table+event
      for (const r of registrations) {
        if (r.table === reg.table && (r.event === '*' || r.event === reg.event || reg.event === '*')) {
          if (!r.filter || r.filter === reg.filter) {
            r.handler(payload);
          }
        }
      }
    });
  }

  ch.subscribe();
  channel = ch;
}

/**
 * Register a realtime handler via the shared hub channel.
 * Multiple components share a single Supabase Realtime channel per user.
 */
export function useRealtimeHub(
  table: string,
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE',
  handler: RealtimeHandler,
  filter?: string,
) {
  const { user } = useAuth();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!user) return;

    const registration: Registration = {
      table,
      event,
      filter,
      handler: (payload: any) => handlerRef.current(payload),
    };

    registrations.push(registration);
    refCount++;

    // Rebuild the channel with the new registration
    rebuildChannel(user.id);

    return () => {
      registrations = registrations.filter(r => r !== registration);
      refCount--;

      if (refCount <= 0) {
        // Last consumer unmounted — tear down channel
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
        currentUserId = null;
        refCount = 0;
      } else if (user.id === currentUserId) {
        // Rebuild without this registration
        rebuildChannel(user.id);
      }
    };
  }, [user, table, event, filter]);
}
