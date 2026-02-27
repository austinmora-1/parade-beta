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
  image_url: string | null;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

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

    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('*')
      .in('conversation_id', conversationIds);

    const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Batch-fetch last messages instead of N+1 queries
    const lastMessages: Record<string, ChatMessage> = {};
    const CONV_BATCH = 50;
    for (let i = 0; i < conversationIds.length; i += CONV_BATCH) {
      const batch = conversationIds.slice(i, i + CONV_BATCH);
      const { data: allMsgs } = await supabase
        .from('chat_messages')
        .select('*')
        .in('conversation_id', batch)
        .order('created_at', { ascending: false });
      // Pick the latest message per conversation
      for (const msg of (allMsgs || []) as ChatMessage[]) {
        if (!lastMessages[msg.conversation_id]) {
          lastMessages[msg.conversation_id] = msg;
        }
      }
    }

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
        const { data: existingDM } = await supabase
          .from('conversations')
          .select('id')
          .eq('type', 'dm')
          .in('id', friendConvos.map(c => c.conversation_id))
          .limit(1);

        if (existingDM?.[0]) return existingDM[0].id;
      }
    }

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

export interface ReadReceipt {
  user_id: string;
  last_read_at: string;
}

const MESSAGES_PAGE_SIZE = 50;

export function useChatMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (!conversationId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0]?.created_at;
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_SIZE);

    const older = ((data as ChatMessage[]) || []).reverse();
    if (older.length < MESSAGES_PAGE_SIZE) setHasMore(false);
    if (older.length > 0) {
      setMessages(prev => [...older, ...prev]);
      // Fetch reactions for older messages
      const { data: rxns } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', older.map(m => m.id));
      if (rxns?.length) {
        setReactions(prev => [...(rxns as MessageReaction[]), ...prev]);
      }
    }
    setLoadingMore(false);
  }, [conversationId, loadingMore, hasMore, messages]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setReadReceipts([]);
      setReactions([]);
      setLoading(false);
      setHasMore(true);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

      const msgs = ((data as ChatMessage[]) || []).reverse();
      setMessages(msgs);
      setHasMore(msgs.length >= MESSAGES_PAGE_SIZE);
      setLoading(false);

      if (user) {
        await supabase
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id);
      }
    };

    const fetchReadReceipts = async () => {
      const { data } = await supabase
        .from('conversation_participants')
        .select('user_id, last_read_at')
        .eq('conversation_id', conversationId);
      if (data) {
        setReadReceipts(data.filter(r => r.user_id !== user?.id));
      }
    };

    const fetchReactions = async () => {
      // Get message IDs for this conversation first
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('conversation_id', conversationId);
      
      if (msgs?.length) {
        const { data } = await supabase
          .from('message_reactions')
          .select('*')
          .in('message_id', msgs.map(m => m.id));
        setReactions((data as MessageReaction[]) || []);
      }
    };

    fetchMessages();
    fetchReadReceipts();
    fetchReactions();

    const msgChannel = supabase
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

    const receiptChannel = supabase
      .channel(`receipts:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as { user_id: string; last_read_at: string };
          if (updated.user_id !== user?.id) {
            setReadReceipts(prev => {
              const existing = prev.filter(r => r.user_id !== updated.user_id);
              return [...existing, { user_id: updated.user_id, last_read_at: updated.last_read_at }];
            });
          }
        }
      )
      .subscribe();

    // Realtime for reactions
    const reactionChannel = supabase
      .channel(`reactions:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          // Refetch all reactions for simplicity
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(receiptChannel);
      supabase.removeChannel(reactionChannel);
    };
  }, [conversationId, user]);

  const sendMessage = useCallback(async (content: string, imageUrl?: string) => {
    if (!conversationId || !user || (!content.trim() && !imageUrl)) return;

    const insertData: any = {
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim() || (imageUrl ? '📷 Photo' : ''),
    };
    if (imageUrl) insertData.image_url = imageUrl;

    await supabase.from('chat_messages').insert(insertData);
  }, [conversationId, user]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    // Check if reaction exists
    const existing = reactions.find(
      r => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji
    );

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
      setReactions(prev => prev.filter(r => r.id !== existing.id));
    } else {
      const { data } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji })
        .select()
        .single();
      if (data) {
        setReactions(prev => [...prev, data as MessageReaction]);
      }
    }
  }, [user, reactions]);

  return { messages, loading, loadingMore, hasMore, loadMore, sendMessage, readReceipts, reactions, toggleReaction };
}
