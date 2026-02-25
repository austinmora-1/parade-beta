import { useState } from 'react';
import { useEllyChat } from '@/hooks/useEllyChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Send, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function EllyWidget() {
  const { messages, isLoading, sendMessage } = useEllyChat();
  const [input, setInput] = useState('');

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage(text);
  };

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

  const quickActions = [
    { label: "Plan something", prompt: "Help me plan something fun this week" },
    { label: "My schedule", prompt: "What does my week look like?" },
    { label: "Suggest ideas", prompt: "Suggest fun plans based on my friends' availability" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/30">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold">Ask Elly</h3>
            <p className="text-[10px] text-muted-foreground">Your planning assistant</p>
          </div>
        </div>
        <Link to="/chat?elly=true">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
            Open Chat
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Last response preview */}
      {lastAssistantMsg && (
        <div className="mb-3 rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground line-clamp-2">{lastAssistantMsg.content}</p>
        </div>
      )}

      {/* Quick action chips */}
      {!lastAssistantMsg && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => sendMessage(action.prompt)}
              disabled={isLoading}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          placeholder="e.g. Plan dinner on Friday..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 text-sm h-9"
          disabled={isLoading}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          size="sm"
          className="h-9 w-9 p-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
