import { useState, useRef, useEffect } from 'react';
import { useEllyChat, EllyMessage } from '@/hooks/useEllyChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Sparkles, ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import ReactMarkdown from 'react-markdown';

interface EllyChatViewProps {
  onBack?: () => void;
  compact?: boolean;
}

export function EllyChatView({ onBack, compact = false }: EllyChatViewProps) {
  const { messages, isLoading, sendMessage, clearHistory } = useEllyChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleInputFocus = () => {
    setTimeout(scrollToBottom, 300);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage(text);
  };

  const formatTime = (date: Date) => {
    if (isToday(date)) return format(date, 'h:mm a');
    return format(date, 'MMM d, h:mm a');
  };

  const suggestions = [
    "Plan dinner with friends this Friday 🍕",
    "What's my schedule this week?",
    "Suggest something fun for the weekend",
    "Move my Saturday plans to Sunday",
  ];

  return (
    <div className={cn("flex flex-col", compact ? "h-full" : "h-full")}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-3 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary">
              <Sparkles className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Elly</h2>
            <p className="text-[11px] text-muted-foreground">Your planning assistant</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" onClick={clearHistory} className="h-8 w-8 text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col justify-end overflow-y-auto overscroll-contain" onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
        <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/30">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-display text-base font-semibold">Hey! I'm Elly ✨</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-[280px]">
              I can help you create plans, check your schedule, and suggest fun things to do!
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-sm">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-2", msg.role === 'user' ? "justify-end" : "justify-start")}
            >
              {msg.role === 'assistant' && (
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary text-[10px]">
                    <Sparkles className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={cn("max-w-[80%]")}>
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-card shadow-soft border border-border"
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {/* Action badges */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 ml-1">
                    {msg.actions.map((action, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                      >
                        {action.type === 'create_plan' && '📅 Plan created'}
                        {action.type === 'update_plan' && '✏️ Plan updated'}
                        {action.type === 'delete_plan' && '🗑️ Plan deleted'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary text-[10px]">
                <Sparkles className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <div className="rounded-2xl bg-card shadow-soft border border-border px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Elly is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="mt-2 flex gap-2 pt-2 border-t border-border shrink-0">
        <Input
          placeholder="Ask Elly anything..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          onFocus={handleInputFocus}
          className="flex-1 rounded-lg text-sm"
          disabled={isLoading}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          size="sm"
          className="rounded-lg"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
