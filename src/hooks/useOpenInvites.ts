import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type OpenInviteAudienceType = 'all_friends' | 'pod' | 'interest' | 'friends';
export type OpenInviteStatus = 'open' | 'claimed' | 'expired' | 'cancelled';

export interface OpenInvite {
  id: string;
  user_id: string;
  title: string;
  activity: string;
  date: string;
  time_slot: string;
  start_time: string | null;
  end_time: string | null;
  duration: number;
  location: string | null;
  notes: string | null;
  audience_type: OpenInviteAudienceType;
  audience_ref: string | null;
  expires_at: string;
  status: OpenInviteStatus;
  claimed_plan_id: string | null;
  notified_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateOpenInviteInput {
  title: string;
  activity: string;
  date: string; // ISO
  time_slot: string;
  start_time?: string | null;
  end_time?: string | null;
  duration?: number;
  location?: string | null;
  notes?: string | null;
  audience_type: OpenInviteAudienceType;
  audience_ref?: string | null;
  expires_at?: string;
  plan_id?: string | null;
  trip_id?: string | null;
}

export function useOpenInvites() {
  const { user } = useAuth();
  const [mine, setMine] = useState<OpenInvite[]>([]);
  const [incoming, setIncoming] = useState<OpenInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setMine([]);
      setIncoming([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [mineRes, incomingRes] = await Promise.all([
      supabase
        .from('open_invites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('open_invites')
        .select('*')
        .neq('user_id', user.id)
        .eq('status', 'open')
        .gt('expires_at', new Date().toISOString())
        .order('date', { ascending: true }),
    ]);
    if (!mineRes.error) setMine((mineRes.data || []) as OpenInvite[]);
    if (!incomingRes.error) setIncoming((incomingRes.data || []) as OpenInvite[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateOpenInviteInput): Promise<OpenInvite | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('open_invites')
        .insert({
          user_id: user.id,
          title: input.title,
          activity: input.activity,
          date: input.date,
          time_slot: input.time_slot,
          start_time: input.start_time ?? null,
          end_time: input.end_time ?? null,
          duration: input.duration ?? 60,
          location: input.location ?? null,
          notes: input.notes ?? null,
          audience_type: input.audience_type,
          audience_ref: input.audience_ref ?? null,
          plan_id: input.plan_id ?? null,
          trip_id: input.trip_id ?? null,
          ...(input.expires_at ? { expires_at: input.expires_at } : {}),
        } as any)
        .select()
        .single();
      if (error) {
        console.error('[useOpenInvites] create error', error);
        return null;
      }
      // Fire-and-forget broadcast push
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        if (token && projectId && data?.id) {
          fetch(`https://${projectId}.supabase.co/functions/v1/on-open-invite`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ open_invite_id: data.id }),
          }).catch(() => {});
        }
      } catch {
        // ignore
      }
      await refresh();
      return data as OpenInvite;
    },
    [user?.id, refresh]
  );

  const cancel = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('open_invites')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) {
        console.error('[useOpenInvites] cancel error', error);
        return;
      }
      await refresh();
    },
    [refresh]
  );

  const claim = useCallback(
    async (openInviteId: string) => {
      if (!user?.id) return null;
      const { data, error } = await supabase.functions.invoke('claim-open-invite', {
        body: { open_invite_id: openInviteId },
      });
      if (error) {
        console.error('[useOpenInvites] claim error', error);
        return null;
      }
      await refresh();
      return data as { success: boolean; plan_id: string | null; trip_id: string | null };
    },
    [user?.id, refresh]
  );

  const decline = useCallback(
    async (openInviteId: string) => {
      if (!user?.id) return;
      await supabase
        .from('open_invite_responses')
        .upsert(
          {
            open_invite_id: openInviteId,
            user_id: user.id,
            response: 'declined',
          },
          { onConflict: 'open_invite_id,user_id' }
        );
      await refresh();
    },
    [user?.id, refresh]
  );

  return { mine, incoming, loading, refresh, create, cancel, claim, decline };
}
