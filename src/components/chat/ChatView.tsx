import { useState, useRef, useEffect } from 'react';
import { useChatMessages, Conversation } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ArrowLeft, Users, Check, CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';

interface ChatViewProps {
  conversation: Conversation;
  onBack: () => void;
}

export function ChatView({ conversation, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const { messages, loading, sendMessage, readReceipts } = useChatMessages(conversation.id);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
  };

  const other = conversation.type === 'dm'
    ? conversation.participants.find(p => p.user_id !== user?.id)
    : null;

  const displayName = conversation.type === 'group'
    ? conversation.title || 'Group Chat'
    : other?.display_name || 'Unknown';

  const participantMap = new Map(
    conversation.participants.map(p => [p.user_id, p])
  );

  const formatMsgTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday ' + format(d, 'h:mm a');
    return format(d, 'MMM d, h:mm a');
  };

  // Determine if a sent message has been seen by other participants
  const isSeenByOthers = (msgCreatedAt: string) => {
    return readReceipts.some(r => new Date(r.last_read_at) >= new Date(msgCreatedAt));
  };

  // Find the last message sent by current user to show the read receipt on
  const myMessages = messages.filter(m => m.sender_id === user?.id);
  const lastSeenMsgId = (() => {
    for (let i = myMessages.length - 1; i >= 0; i--) {
      if (isSeenByOthers(myMessages[i].created_at)) {
        return myMessages[i].id;
      }
    }
    return null;
  })();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border pb-3 mb-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-9 w-9 shrink-0">
          {other?.avatar_url ? <AvatarImage src={other.avatar_url} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {conversation.type === 'group'
              ? <Users className="h-4 w-4" />
              : displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{displayName}</h2>
          {conversation.type === 'group' && (
            <p className="truncate text-[11px] text-muted-foreground">
              {conversation.participants.map(p => p.display_name || 'Unknown').join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground animate-pulse">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Say hello! 👋</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            const sender = participantMap.get(msg.sender_id);
            const isLastMessage = idx === messages.length - 1;

            return (
              <div
                key={msg.id}
                className={cn("flex gap-2", isMe ? "justify-end" : "justify-start")}
              >
                {!isMe && (
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    {sender?.avatar_url ? <AvatarImage src={sender.avatar_url} /> : null}
                    <AvatarFallback className="bg-muted text-[10px]">
                      {(sender?.display_name || '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={cn("max-w-[75%]", isMe ? "items-end" : "items-start")}>
                  {conversation.type === 'group' && !isMe && (
                    <p className="mb-0.5 text-[10px] font-medium text-muted-foreground ml-1">
                      {sender?.display_name || 'Unknown'}
                    </p>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-card shadow-soft border border-border"
                    )}
                  >
                    {msg.content}
                  </div>
                  {isLastMessage && (
                    <div className={cn(
                      "mt-0.5 flex items-center gap-1",
                      isMe ? "justify-end mr-1" : "ml-1"
                    )}>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatMsgTime(msg.created_at)}
                      </span>
                      {isMe && (
                        lastSeenMsgId === msg.id ? (
                          <CheckCheck className="h-3 w-3 text-primary" />
                        ) : (
                          <Check className="h-3 w-3 text-muted-foreground/40" />
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 pt-3 border-t border-border shrink-0">
        <Input
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 rounded-lg text-sm"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim()}
          size="sm"
          className="rounded-lg"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
