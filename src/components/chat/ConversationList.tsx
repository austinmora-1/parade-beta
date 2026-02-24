import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { Conversation } from '@/hooks/useChat';
import { formatDistanceToNow } from 'date-fns';
import { Users } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, activeId, onSelect }: ConversationListProps) {
  const { user } = useAuth();

  const getDisplayInfo = (convo: Conversation) => {
    if (convo.type === 'group') {
      return {
        name: convo.title || 'Group Chat',
        avatar: null,
        isGroup: true,
      };
    }
    const other = convo.participants.find(p => p.user_id !== user?.id);
    return {
      name: other?.display_name || 'Unknown',
      avatar: other?.avatar_url,
      isGroup: false,
    };
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">No conversations yet</p>
        <p className="mt-1 text-xs text-muted-foreground/70">Start a chat with a friend!</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map(convo => {
        const info = getDisplayInfo(convo);
        const isActive = activeId === convo.id;
        const preview = convo.last_message?.content || 'No messages yet';
        const time = convo.last_message
          ? formatDistanceToNow(new Date(convo.last_message.created_at), { addSuffix: false })
          : '';

        return (
          <button
            key={convo.id}
            onClick={() => onSelect(convo.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
              isActive
                ? "bg-primary/10 border border-primary/20"
                : "hover:bg-accent border border-transparent"
            )}
          >
            <Avatar className="h-10 w-10 shrink-0">
              {info.avatar ? <AvatarImage src={info.avatar} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {info.isGroup ? <Users className="h-4 w-4" /> : info.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{info.name}</span>
                {time && <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>}
              </div>
              <p className="truncate text-xs text-muted-foreground">{preview}</p>
            </div>
            {convo.unread_count > 0 && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {convo.unread_count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
