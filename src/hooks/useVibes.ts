import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';

export interface VibeSend {
  id: string;
  sender_id: string;
  vibe_type: string;
  custom_tags: string[];
  message: string | null;
  media_url: string | null;
  media_type: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  target_type: string;
  created_at: string;
  // Joined data
  sender_name?: string;
  sender_avatar?: string;
  is_read?: boolean;
  recipient_entry_id?: string;
}

export interface SendVibePayload {
  vibe_type: string;
  custom_tags?: string[];
  message?: string;
  media_url?: string;
  media_type?: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  target_type: 'broadcast' | 'pod' | 'selected';
  recipient_ids?: string[];
}

export function useVibes() {
  const { user } = useAuth();
  const { friends } = usePlannerStore();
  const [receivedVibes, setReceivedVibes] = useState<VibeSend[]>([]);
  const [sentVibes, setSentVibes] = useState<VibeSend[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVibes = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load received vibes
      const { data: recipientData } = await supabase
        .from('vibe_send_recipients')
        .select('id, vibe_send_id, read_at')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (recipientData && recipientData.length > 0) {
        const vibeIds = recipientData.map(r => r.vibe_send_id);
        const { data: vibesData } = await supabase
          .from('vibe_sends')
          .select('*')
          .in('id', vibeIds)
          .order('created_at', { ascending: false });

        // Get sender profiles
        const senderIds = [...new Set((vibesData || []).map(v => v.sender_id))];
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', senderIds);

        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        const recipientMap = new Map(recipientData.map(r => [r.vibe_send_id, r]));

        const mapped: VibeSend[] = (vibesData || []).map(v => {
          const profile = profileMap.get(v.sender_id);
          const recipient = recipientMap.get(v.id);
          return {
            ...v,
            custom_tags: v.custom_tags || [],
            sender_name: profile?.display_name || 'Someone',
            sender_avatar: profile?.avatar_url || undefined,
            is_read: !!recipient?.read_at,
            recipient_entry_id: recipient?.id,
          };
        });

        setReceivedVibes(mapped);
      } else {
        setReceivedVibes([]);
      }

      // Load sent vibes
      const { data: sentData } = await supabase
        .from('vibe_sends')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setSentVibes((sentData || []).map(v => ({ ...v, custom_tags: v.custom_tags || [] })));
    } catch (err) {
      console.error('Error loading vibes:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVibes();
  }, [loadVibes]);

  // Realtime subscription for new vibes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('vibe-recipients')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vibe_send_recipients',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          loadVibes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadVibes]);

  const sendVibe = async (payload: SendVibePayload) => {
    if (!user) return;

    try {
      // Create the vibe send
      const { data: vibeSend, error: vibeError } = await supabase
        .from('vibe_sends')
        .insert({
          sender_id: user.id,
          vibe_type: payload.vibe_type,
          custom_tags: payload.custom_tags || [],
          message: payload.message || null,
          media_url: payload.media_url || null,
          media_type: payload.media_type || null,
          location_name: payload.location_name || null,
          location_lat: payload.location_lat || null,
          location_lng: payload.location_lng || null,
          target_type: payload.target_type,
        })
        .select()
        .single();

      if (vibeError) throw vibeError;

      // Determine recipients
      let recipientIds: string[] = [];

      if (payload.target_type === 'broadcast') {
        recipientIds = friends
          .filter(f => f.status === 'connected' && f.friendUserId)
          .map(f => f.friendUserId!);
      } else if (payload.target_type === 'pod') {
        recipientIds = friends
          .filter(f => f.status === 'connected' && f.isPodMember && f.friendUserId)
          .map(f => f.friendUserId!);
      } else if (payload.target_type === 'selected') {
        recipientIds = payload.recipient_ids || [];
      }

      if (recipientIds.length === 0) {
        toast.error('No recipients found');
        return;
      }

      // Insert recipients
      const { error: recipientError } = await supabase
        .from('vibe_send_recipients')
        .insert(
          recipientIds.map(id => ({
            vibe_send_id: vibeSend.id,
            recipient_id: id,
          }))
        );

      if (recipientError) throw recipientError;

      toast.success(`Vibe sent to ${recipientIds.length} friend${recipientIds.length > 1 ? 's' : ''}!`);
      loadVibes();
    } catch (err: any) {
      console.error('Error sending vibe:', err);
      toast.error('Failed to send vibe');
    }
  };

  const markAsRead = async (recipientEntryId: string) => {
    if (!user) return;
    
    await supabase
      .from('vibe_send_recipients')
      .update({ read_at: new Date().toISOString() })
      .eq('id', recipientEntryId);

    setReceivedVibes(prev =>
      prev.map(v =>
        v.recipient_entry_id === recipientEntryId ? { ...v, is_read: true } : v
      )
    );
  };

  const unreadCount = receivedVibes.filter(v => !v.is_read).length;

  return {
    receivedVibes,
    sentVibes,
    loading,
    sendVibe,
    markAsRead,
    unreadCount,
    refresh: loadVibes,
  };
}
