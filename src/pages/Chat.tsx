import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Calendar, Clock, MapPin } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: `Hey there! 👋 I'm Elly, your AI planning assistant. I can help you:

• Create and manage your plans
• Check and update your availability  
• Find the perfect time to meet with friends
• Suggest activities based on your vibes

What would you like to plan today?`,
};

const QUICK_ACTIONS = [
  { icon: Calendar, label: 'Create a plan', message: 'Help me create a new plan' },
  { icon: Clock, label: 'Check availability', message: 'Show me my availability this week' },
  { icon: MapPin, label: 'Find a spot', message: 'Suggest a good place for brunch' },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "I'd love to help you with that! Let me think about the best options...",
        "Great idea! Based on your schedule, I can see you have some free time. Would you like me to suggest some times?",
        "Sure thing! I can help you set that up. Just give me a few more details and we'll get it sorted.",
        "That sounds fun! Let me check your friends' availability too so we can find a time that works for everyone.",
      ];

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responses[Math.floor(Math.random() * responses.length)],
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="animate-fade-in flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
          <Sparkles className="h-7 w-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Chat with Elly</h1>
          <p className="text-sm text-muted-foreground">
            Your AI planning assistant
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card/50 p-6">
        <div className="space-y-6">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
            />
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-soft">
                <Sparkles className="h-5 w-5 text-primary-foreground animate-pulse" />
              </div>
              <div className="rounded-2xl bg-card shadow-soft border border-border px-4 py-3">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length === 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleSend(action.message)}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground"
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="mt-4 flex gap-3">
        <Input
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 rounded-xl"
        />
        <Button
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
          className="rounded-xl"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
