import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Conversation {
  id: string;
  type: 'dm' | 'group';
  title: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  participants: Participant[];
  last_message?: ChatMessage | null;
  unread_count: number;
}

export interface Participant {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: string;
  last_read_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    // Get conversations the user participates in
    const { data: participations } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!participations?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = participations.map(p => p.conversation_id);

    const { data: convos } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });

    if (!convos) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Get all participants for these conversations
    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('*')
      .in('conversation_id', conversationIds);

    // Get profile info for participants
    const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Get last message for each conversation
    const lastMessages: Record<string, ChatMessage> = {};
    for (const id of conversationIds) {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (msgs?.[0]) lastMessages[id] = msgs[0];
    }

    // Get unread counts
    const myParticipations = allParticipants?.filter(p => p.user_id === user.id) || [];
    const lastReadMap = new Map(myParticipations.map(p => [p.conversation_id, p.last_read_at]));

    const enriched: Conversation[] = convos.map(c => {
      const parts = allParticipants?.filter(p => p.conversation_id === c.id) || [];
      const participants: Participant[] = parts.map(p => ({
        user_id: p.user_id,
        display_name: profileMap.get(p.user_id)?.display_name || null,
        avatar_url: profileMap.get(p.user_id)?.avatar_url || null,
        joined_at: p.joined_at,
        last_read_at: p.last_read_at,
      }));

      const lastRead = lastReadMap.get(c.id);
      const lastMsg = lastMessages[c.id];
      const unread_count = lastMsg && lastRead && new Date(lastMsg.created_at) > new Date(lastRead) ? 1 : 0;

      return {
        ...c,
        type: c.type as 'dm' | 'group',
        participants,
        last_message: lastMsg || null,
        unread_count,
      };
    });

    setConversations(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createDM = useCallback(async (friendUserId: string) => {
    if (!user) return null;

    // Check if DM already exists
    const { data: myConvos } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (myConvos?.length) {
      const { data: friendConvos } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', friendUserId)
        .in('conversation_id', myConvos.map(c => c.conversation_id));

      if (friendConvos?.length) {
        // Check if any of these are DMs
        const { data: existingDM } = await supabase
          .from('conversations')
          .select('id')
          .eq('type', 'dm')
          .in('id', friendConvos.map(c => c.conversation_id))
          .limit(1);

        if (existingDM?.[0]) return existingDM[0].id;
      }
    }

    // Create new DM
    const { data: convo, error } = await supabase
      .from('conversations')
      .insert({ type: 'dm', created_by: user.id })
      .select()
      .single();

    if (error || !convo) {
      console.error('Failed to create DM conversation:', error);
      toast.error('Could not start chat. Please try again.');
      return null;
    }

    // Add both participants
    const { error: participantsError } = await supabase.from('conversation_participants').insert([
      { conversation_id: convo.id, user_id: user.id },
      { conversation_id: convo.id, user_id: friendUserId },
    ]);

    if (participantsError) {
      console.error('Failed to add DM participants:', participantsError);
      toast.error('Could not start chat. Please try again.');
      return null;
    }

    await fetchConversations();
    return convo.id;
  }, [user, fetchConversations]);

  const createGroup = useCallback(async (title: string, memberUserIds: string[]) => {
    if (!user) return null;

    const { data: convo, error } = await supabase
      .from('conversations')
      .insert({ type: 'group', title, created_by: user.id })
      .select()
      .single();

    if (error || !convo) {
      console.error('Failed to create group conversation:', error);
      toast.error('Could not create group chat. Please try again.');
      return null;
    }

    const participants = [user.id, ...memberUserIds].map(uid => ({
      conversation_id: convo.id,
      user_id: uid,
    }));

    const { error: participantsError } = await supabase.from('conversation_participants').insert(participants);
    if (participantsError) {
      console.error('Failed to add group participants:', participantsError);
      toast.error('Could not create group chat. Please try again.');
      return null;
    }

    await fetchConversations();
    return convo.id;
  }, [user, fetchConversations]);

  return { conversations, loading, fetchConversations, createDM, createGroup };
}

export function useChatMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      setMessages(data || []);
      setLoading(false);

      // Mark as read
      if (user) {
        await supabase
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id);
      }
    };

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => [...prev, newMsg]);

          // Mark as read
          if (user) {
            supabase
              .from('conversation_participants')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', conversationId)
              .eq('user_id', user.id)
              .then();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !user || !content.trim()) return;

    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    });
  }, [conversationId, user]);

  return { messages, loading, sendMessage };
}
