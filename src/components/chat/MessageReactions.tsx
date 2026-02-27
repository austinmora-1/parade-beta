import { MessageReaction } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus } from 'lucide-react';
import { useState } from 'react';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface MessageReactionsProps {
  messageId: string;
  reactions: MessageReaction[];
  currentUserId: string;
  onToggleReaction: (messageId: string, emoji: string) => void;
  isMe: boolean;
}

export function MessageReactions({ messageId, reactions, currentUserId, onToggleReaction, isMe }: MessageReactionsProps) {
  const [open, setOpen] = useState(false);
  const msgReactions = reactions.filter(r => r.message_id === messageId);

  // Group reactions by emoji
  const grouped = new Map<string, { count: number; userReacted: boolean }>();
  msgReactions.forEach(r => {
    const existing = grouped.get(r.emoji) || { count: 0, userReacted: false };
    existing.count++;
    if (r.user_id === currentUserId) existing.userReacted = true;
    grouped.set(r.emoji, existing);
  });

  return (
    <div className={cn("flex items-center gap-1 mt-0.5", isMe ? "justify-end" : "justify-start")}>
      {/* Existing reactions */}
      {Array.from(grouped.entries()).map(([emoji, { count, userReacted }]) => (
        <button
          key={emoji}
          onClick={() => onToggleReaction(messageId, emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] border transition-colors",
            userReacted
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/20"
          )}
        >
          <span>{emoji}</span>
          {count > 1 && <span className="font-medium">{count}</span>}
        </button>
      ))}

      {/* Add reaction button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors">
            <SmilePlus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5 z-[70]" side="top" align={isMe ? "end" : "start"}>
          <div className="flex gap-1">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  onToggleReaction(messageId, emoji);
                  setOpen(false);
                }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-lg hover:bg-muted transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
