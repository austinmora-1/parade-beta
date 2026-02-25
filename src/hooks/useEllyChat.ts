import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface EllyMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: Array<{ type: string; args: Record<string, any> }>;
  timestamp: Date;
}

const STORAGE_KEY = 'elly-chat-history';

function loadPersistedMessages(): EllyMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function persistMessages(messages: EllyMessage[]) {
  // Keep last 50 messages to avoid bloating localStorage
  const trimmed = messages.slice(-50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function useEllyChat() {
  const { user, session } = useAuth();
  const { plans, friends, availability, loadAllData } = usePlannerStore();
  const [messages, setMessages] = useState<EllyMessage[]>(loadPersistedMessages);
  const [isLoading, setIsLoading] = useState(false);

  const buildContext = useCallback(() => {
    // Get user's display name
    const userName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'there';

    // Upcoming plans (next 14 days)
    const upcomingPlans = plans
      .filter(p => p.date >= new Date())
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        title: p.title,
        activity: p.activity,
        date: format(p.date, 'yyyy-MM-dd'),
        timeSlot: p.timeSlot,
        duration: p.duration,
        location: p.location?.name,
        notes: p.notes,
      }));

    // Connected friends
    const connectedFriends = friends
      .filter(f => f.status === 'connected')
      .map(f => ({ name: f.name, id: f.friendUserId }));

    // This week's availability summary
    const availSummary = availability.slice(0, 7).map(a => ({
      date: format(a.date, 'yyyy-MM-dd (EEE)'),
      freeSlots: Object.entries(a.slots)
        .filter(([, v]) => v)
        .map(([k]) => k),
      location: a.locationStatus,
    }));

    return { userName, plans: upcomingPlans, friends: connectedFriends, availability: availSummary };
  }, [user, plans, friends, availability]);

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || !user || !session) return;

    const userMsg: EllyMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    persistMessages(updated);
    setIsLoading(true);

    try {
      // Build API messages (last 20 for context window)
      const apiMessages = updated.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('chat-with-elly', {
        body: { messages: apiMessages, context: buildContext() },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMsg: EllyMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        actions: data.actions,
        timestamp: new Date(),
      };

      const withReply = [...updated, assistantMsg];
      setMessages(withReply);
      persistMessages(withReply);

      // If Elly performed any actions, reload data to reflect changes
      if (data.actions?.length > 0) {
        await loadAllData();
        toast.success('Elly updated your plans! 🎉');
      }
    } catch (e: any) {
      console.error('Elly chat error:', e);
      const errorMsg: EllyMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: e.message || "Sorry, I couldn't process that. Try again? 🙏",
        timestamp: new Date(),
      };
      const withError = [...updated, errorMsg];
      setMessages(withError);
      persistMessages(withError);
    } finally {
      setIsLoading(false);
    }
  }, [messages, user, session, buildContext, loadAllData]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { messages, isLoading, sendMessage, clearHistory };
}
