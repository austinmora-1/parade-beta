import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus, MessageCircle } from 'lucide-react';
import { useState } from 'react';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '💯', '🙌'];

export interface VibeReaction {
  id: string;
  vibe_send_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface VibeReactionsProps {
  vibeSendId: string;
  reactions: VibeReaction[];
  currentUserId: string;
  onToggleReaction: (vibeSendId: string, emoji: string) => void;
  commentCount?: number;
}

export function VibeReactions({ vibeSendId, reactions, currentUserId, onToggleReaction, commentCount = 0 }: VibeReactionsProps) {
  const [open, setOpen] = useState(false);
  const vibeReactions = reactions.filter(r => r.vibe_send_id === vibeSendId);

  const grouped = new Map<string, { count: number; userReacted: boolean }>();
  vibeReactions.forEach(r => {
    const existing = grouped.get(r.emoji) || { count: 0, userReacted: false };
    existing.count++;
    if (r.user_id === currentUserId) existing.userReacted = true;
    grouped.set(r.emoji, existing);
  });

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {commentCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] border border-border bg-card text-muted-foreground">
          <MessageCircle className="h-3 w-3" />
          <span className="font-medium">{commentCount}</span>
        </span>
      )}
      {Array.from(grouped.entries()).map(([emoji, { count, userReacted }]) => (
        <button
          key={emoji}
          onClick={(e) => { e.stopPropagation(); onToggleReaction(vibeSendId, emoji); }}
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

      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors"
          >
            <SmilePlus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5 z-[80]" side="top" align="start">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReaction(vibeSendId, emoji);
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
