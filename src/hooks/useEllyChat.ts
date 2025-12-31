import { useState, useCallback } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { ActivityType, TimeSlot, Friend } from '@/types/planner';
import { parse, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday } from 'date-fns';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface PlanAction {
  action: 'create_plan';
  plan: {
    title: string;
    activityType: ActivityType;
    date: string;
    timeSlot: TimeSlot;
    duration: string;
    location: string;
    friends: string[];
    notes?: string;
  };
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-elly`;

const durationToMinutes = (duration: string): number => {
  const map: Record<string, number> = {
    '1h': 60,
    '2h': 120,
    '3h': 180,
    '4h': 240,
    'half-day': 360,
    'full-day': 720,
  };
  return map[duration] || 120;
};

const parseRelativeDate = (dateStr: string): Date => {
  const today = new Date();
  const lower = dateStr.toLowerCase();
  
  if (lower === 'today') return today;
  if (lower === 'tomorrow') return addDays(today, 1);
  if (lower.includes('monday')) return nextMonday(today);
  if (lower.includes('tuesday')) return nextTuesday(today);
  if (lower.includes('wednesday')) return nextWednesday(today);
  if (lower.includes('thursday')) return nextThursday(today);
  if (lower.includes('friday')) return nextFriday(today);
  if (lower.includes('saturday')) return nextSaturday(today);
  if (lower.includes('sunday')) return nextSunday(today);
  
  // Try parsing as ISO date
  try {
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  } catch {
    return today;
  }
};

export function useEllyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addPlan, friends } = usePlannerStore();

  const extractAndExecuteActions = useCallback((content: string) => {
    // Look for JSON blocks in the response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return;

    try {
      const action: PlanAction = JSON.parse(jsonMatch[1]);
      
      if (action.action === 'create_plan') {
        const planData = action.plan;
        
        // Match friends by name
        const matchedFriends: Friend[] = planData.friends
          .map(friendName => {
            const found = friends.find(f => 
              f.name.toLowerCase().includes(friendName.toLowerCase()) ||
              friendName.toLowerCase().includes(f.name.toLowerCase())
            );
            return found;
          })
          .filter((f): f is Friend => f !== undefined);

        const newPlan = {
          id: crypto.randomUUID(),
          title: planData.title,
          activity: planData.activityType,
          date: parseRelativeDate(planData.date),
          timeSlot: planData.timeSlot,
          duration: durationToMinutes(planData.duration),
          location: planData.location ? {
            id: crypto.randomUUID(),
            name: planData.location,
            address: planData.location,
          } : undefined,
          participants: matchedFriends,
          notes: planData.notes,
          createdAt: new Date(),
        };

        addPlan(newPlan);
        toast.success(`Plan created: ${planData.title}`);
      }
    } catch (e) {
      console.error('Failed to parse action:', e);
    }
  }, [addPlan, friends]);

  const sendMessage = useCallback(async (input: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantContent = '';
    
    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { id: crypto.randomUUID(), role: 'assistant', content: assistantContent }];
      });
    };

    try {
      const allMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Extract and execute any actions from the response
      extractAndExecuteActions(assistantContent);

    } catch (e) {
      console.error('Chat error:', e);
      toast.error(e instanceof Error ? e.message : 'Failed to send message');
      // Remove the user message if we failed
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
    }
  }, [messages, extractAndExecuteActions]);

  const resetChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    resetChat,
  };
}
