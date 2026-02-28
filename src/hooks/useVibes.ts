import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';
import type { VibeReaction } from '@/components/vibes/VibeReactions';

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
  const [vibeReactions, setVibeReactions] = useState<VibeReaction[]>([]);
  const [sentVibeReactions, setSentVibeReactions] = useState<VibeReaction[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
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

        // Load reactions for received vibes
        const { data: reactionsData } = await supabase
          .from('vibe_reactions')
          .select('*')
          .in('vibe_send_id', vibeIds);

        setVibeReactions(reactionsData as VibeReaction[] || []);
      } else {
        setReceivedVibes([]);
        setVibeReactions([]);
      }
      // Load sent vibes
      const { data: sentData } = await supabase
        .from('vibe_sends')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const mappedSent = (sentData || []).map(v => ({ ...v, custom_tags: v.custom_tags || [] }));
      setSentVibes(mappedSent);

      // Load reactions for sent vibes
      if (mappedSent.length > 0) {
        const sentIds = mappedSent.map(v => v.id);
        const { data: sentReactionsData } = await supabase
          .from('vibe_reactions')
          .select('*')
          .in('vibe_send_id', sentIds);
        setSentVibeReactions(sentReactionsData as VibeReaction[] || []);
      } else {
        setSentVibeReactions([]);
      }

      // Load comment counts for all vibes
      const allVibeIds = [
        ...(recipientData || []).map(r => r.vibe_send_id),
        ...(sentData || []).map(v => v.id),
      ];
      if (allVibeIds.length > 0) {
        const uniqueIds = [...new Set(allVibeIds)];
        const { data: commentsData } = await supabase
          .from('vibe_comments')
          .select('vibe_send_id')
          .in('vibe_send_id', uniqueIds);
        
        const counts: Record<string, number> = {};
        (commentsData || []).forEach(c => {
          counts[c.vibe_send_id] = (counts[c.vibe_send_id] || 0) + 1;
        });
        setCommentCounts(counts);
      } else {
        setCommentCounts({});
      }
    } catch (err) {
      console.error('Error loading vibes:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVibes();
  }, [loadVibes]);

  // Realtime subscription for incoming vibes (new + dismissed)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('vibe-recipients')
      .on(
        'postgres_changes',
        {
          event: '*',
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

  // Realtime subscription for sent vibes (auto-sync when user sends a new vibe)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('vibe-sends-own')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vibe_sends',
          filter: `sender_id=eq.${user.id}`,
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

  // Realtime subscription for reactions on sent vibes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('sent-vibe-reactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vibe_reactions',
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

      // Send push notifications to recipients (fire-and-forget)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single();
        const senderName = senderProfile?.display_name || 'Someone';
        const vibeLabel = payload.vibe_type === 'custom' 
          ? (payload.custom_tags?.[0] || 'a vibe') 
          : payload.vibe_type;

        for (const recipientId of recipientIds) {
          fetch(
            `https://${projectId}.supabase.co/functions/v1/send-push-notification`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: recipientId,
                title: `${senderName} sent you a vibe`,
                body: payload.message || `Feeling ${vibeLabel}`,
                url: '/',
              }),
            }
          ).catch(() => {}); // fire-and-forget
        }
      }

      toast.success(`Vibe sent to ${recipientIds.length} friend${recipientIds.length > 1 ? 's' : ''}!`);
      loadVibes();
    } catch (err: any) {
      console.error('Error sending vibe:', err);
      toast.error('Failed to send vibe');
    }
  };

  const dismissVibe = async (recipientEntryId: string) => {
    if (!user) return;

    await supabase
      .from('vibe_send_recipients')
      .delete()
      .eq('id', recipientEntryId);

    setReceivedVibes(prev => prev.filter(v => v.recipient_entry_id !== recipientEntryId));
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

  const toggleVibeReaction = async (vibeSendId: string, emoji: string) => {
    if (!user) return;

    const existing = vibeReactions.find(
      r => r.vibe_send_id === vibeSendId && r.user_id === user.id && r.emoji === emoji
    );

    if (existing) {
      await supabase.from('vibe_reactions').delete().eq('id', existing.id);
      setVibeReactions(prev => prev.filter(r => r.id !== existing.id));
    } else {
      const { data, error } = await supabase
        .from('vibe_reactions')
        .insert({ vibe_send_id: vibeSendId, user_id: user.id, emoji })
        .select()
        .single();

      if (!error && data) {
        setVibeReactions(prev => [...prev, data as VibeReaction]);
      }
    }
  };

  const unreadCount = receivedVibes.filter(v => !v.is_read).length;

  return {
    receivedVibes,
    sentVibes,
    vibeReactions,
    sentVibeReactions,
    commentCounts,
    loading,
    sendVibe,
    markAsRead,
    dismissVibe,
    toggleVibeReaction,
    unreadCount,
    refresh: loadVibes,
  };
}
