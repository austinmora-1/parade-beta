import { X, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELLY_USER_ID } from '@/lib/constants';

interface ReplyPreviewProps {
  senderName: string;
  senderId: string;
  content: string;
  onClear?: () => void;
  /** Compact version shown inside a message bubble */
  inline?: boolean;
  onClick?: () => void;
}

export function ReplyPreview({ senderName, senderId, content, onClear, inline, onClick }: ReplyPreviewProps) {
  const isElly = senderId === ELLY_USER_ID;
  const displayName = isElly ? 'Elly ✨' : senderName;
  const truncated = content.length > 80 ? content.slice(0, 80) + '…' : content;

  if (inline) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex items-start gap-1.5 w-full rounded-lg px-2 py-1.5 mb-1 text-left transition-colors",
          "bg-foreground/5 border-l-2 border-primary/40"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-[10px] font-semibold leading-tight",
            isElly ? "text-primary" : "text-primary/80"
          )}>
            {displayName}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight line-clamp-1 mt-0.5">
            {truncated || '📷 Photo'}
          </p>
        </div>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 animate-fade-in">
      <Reply className="h-3.5 w-3.5 text-primary shrink-0 scale-x-[-1]" />
      <div className="min-w-0 flex-1">
        <p className={cn(
          "text-[11px] font-semibold leading-tight",
          isElly ? "text-primary" : "text-foreground"
        )}>
          {displayName}
        </p>
        <p className="text-xs text-muted-foreground leading-tight line-clamp-1 mt-0.5">
          {truncated || '📷 Photo'}
        </p>
      </div>
      {onClear && (
        <button onClick={onClear} className="shrink-0 rounded-full p-0.5 hover:bg-muted transition-colors">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
