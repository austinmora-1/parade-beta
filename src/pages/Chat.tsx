import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Calendar, Clock, MapPin, RotateCcw } from 'lucide-react';
import { useEllyChat } from '@/hooks/useEllyChat';

const QUICK_ACTIONS = [
  { icon: Calendar, label: 'Create a plan', message: 'Help me create a new plan' },
  { icon: Clock, label: 'Check availability', message: 'Show me my availability this week' },
  { icon: MapPin, label: 'Find a spot', message: 'Suggest a good place for brunch' },
];

export default function Chat() {
  const { messages, isLoading, sendMessage, resetChat } = useEllyChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    setInput('');
    await sendMessage(text);
  };

  // Filter out JSON blocks from display
  const cleanMessageContent = (content: string) => {
    return content.replace(/```json\s*[\s\S]*?\s*```/g, '').trim();
  };

  return (
    <div className="animate-fade-in flex h-[calc(100vh-7rem)] flex-col md:h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between md:mb-6">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow md:h-14 md:w-14 md:rounded-2xl">
            <Sparkles className="h-5 w-5 text-primary-foreground md:h-7 md:w-7" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold md:text-2xl">Chat with Elly</h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              Your AI planning assistant
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={resetChat} className="gap-1.5 md:gap-2">
            <RotateCcw className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">New chat</span>
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card/50 p-4 md:rounded-2xl md:p-6">
        <div className="space-y-4 md:space-y-6">
          {messages.length === 0 && (
            <ChatMessage
              role="assistant"
              content={`Hey there! 👋 I'm Elly, your AI planning assistant. I can help you:

• Create and manage your plans
• Check and update your availability  
• Find the perfect time to meet with friends
• Suggest activities based on your vibes

What would you like to plan today?`}
            />
          )}
          
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={cleanMessageContent(message.content)}
            />
          ))}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-2 md:gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary shadow-soft md:h-10 md:w-10 md:rounded-xl">
                <Sparkles className="h-4 w-4 text-primary-foreground animate-pulse md:h-5 md:w-5" />
              </div>
              <div className="rounded-xl bg-card shadow-soft border border-border px-3 py-2 md:rounded-2xl md:px-4 md:py-3">
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce md:h-2 md:w-2" style={{ animationDelay: '0ms' }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce md:h-2 md:w-2" style={{ animationDelay: '150ms' }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce md:h-2 md:w-2" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2 md:mt-4">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleSend(action.message)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent hover:text-accent-foreground md:gap-2 md:rounded-xl md:px-4 md:py-2 md:text-sm"
            >
              <action.icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="mt-3 flex gap-2 md:mt-4 md:gap-3">
        <Input
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 rounded-lg text-sm md:rounded-xl md:text-base"
          disabled={isLoading}
        />
        <Button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          size="sm"
          className="rounded-lg md:rounded-xl md:size-default"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
