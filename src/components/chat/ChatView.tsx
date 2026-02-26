import { useState, useRef, useEffect } from 'react';
import { useChatMessages, Conversation } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ArrowLeft, Users, Check, CheckCheck, Sparkles, Loader2 } from 'lucide-react';
import { FriendLink } from '@/components/ui/FriendLink';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { ELLY_USER_ID } from '@/lib/constants';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { MessageReactions } from './MessageReactions';
import { ChatImageUpload } from './ChatImageUpload';
import { EmojiPicker } from './EmojiPicker';

interface ChatViewProps {
  conversation: Conversation;
  onBack: () => void;
}

export function ChatView({ conversation, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const { loadAllData } = usePlannerStore();
  const { messages, loading, sendMessage, readReceipts, reactions, toggleReaction } = useChatMessages(conversation.id);
  const [input, setInput] = useState('');
  const [ellyLoading, setEllyLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputFocus = () => {
    setTimeout(scrollToBottom, 300);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);

    if (/@elly/i.test(text)) {
      setEllyLoading(true);
      try {
        const cleanedMessage = text.replace(/@elly/gi, '').trim();
        const { data, error } = await supabase.functions.invoke('elly-conversation-assist', {
          body: { conversation_id: conversation.id, message: cleanedMessage },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.actions?.length > 0) {
          await loadAllData();
          toast.success('Elly updated your plans! 🎉');
        }
      } catch (e: any) {
        console.error('Elly conversation error:', e);
        toast.error(e.message || 'Elly couldn\'t process that right now');
      } finally {
        setEllyLoading(false);
      }
    }
  };

  const handleImageUploaded = async (url: string) => {
    await sendMessage('', url);
  };

  const insertEllyMention = () => {
    setInput(prev => {
      const prefix = prev.endsWith(' ') || prev === '' ? '' : ' ';
      return prev + prefix + '@Elly ';
    });
  };

  const insertEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
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

  const isSeenByOthers = (msgCreatedAt: string) => {
    return readReceipts.some(r => new Date(r.last_read_at) >= new Date(msgCreatedAt));
  };

  const myMessages = messages.filter(m => m.sender_id === user?.id);
  const lastSeenMsgId = (() => {
    for (let i = myMessages.length - 1; i >= 0; i--) {
      if (isSeenByOthers(myMessages[i].created_at)) {
        return myMessages[i].id;
      }
    }
    return null;
  })();

  const isEllyMessage = (senderId: string) => senderId === ELLY_USER_ID;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 shrink-0 bg-background flex items-center gap-3 border-b border-border pb-3 mb-3 min-w-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FriendLink userId={other?.user_id}>
          <Avatar className="h-9 w-9 shrink-0">
            {other?.avatar_url ? <AvatarImage src={other.avatar_url} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {conversation.type === 'group'
                ? <Users className="h-4 w-4" />
                : displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </FriendLink>
        <div className="min-w-0 flex-1">
          <FriendLink userId={other?.user_id}>
            <h2 className="text-sm font-semibold hover:underline break-words line-clamp-2">{displayName}</h2>
          </FriendLink>
          {conversation.type === 'group' && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              {conversation.participants.map(p => p.display_name || 'Unknown').join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex flex-1 flex-col justify-end overflow-y-auto overscroll-contain" onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
        <div className="space-y-3">
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
            const isElly = isEllyMessage(msg.sender_id);
            const sender = participantMap.get(msg.sender_id);
            const isLastMessage = idx === messages.length - 1;

            return (
              <div
                key={msg.id}
                className={cn("flex gap-2", isMe ? "justify-end" : "justify-start")}
              >
                {!isMe && (
                  <FriendLink userId={isElly ? null : msg.sender_id}>
                    <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                      {isElly ? (
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary text-[10px]">
                          <Sparkles className="h-3 w-3" />
                        </AvatarFallback>
                      ) : (
                        <>
                          {sender?.avatar_url ? <AvatarImage src={sender.avatar_url} /> : null}
                          <AvatarFallback className="bg-muted text-[10px]">
                            {(sender?.display_name || '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                  </FriendLink>
                )}
                <div className={cn("max-w-[75%]", isMe ? "items-end" : "items-start")}>
                  {!isMe && (
                    <p className={cn(
                      "mb-0.5 text-[10px] font-medium ml-1",
                      isElly ? "text-primary" : "text-muted-foreground"
                    )}>
                      {isElly ? 'Elly ✨' : (
                        <FriendLink userId={msg.sender_id}>
                          <span className="hover:underline">{sender?.display_name || 'Unknown'}</span>
                        </FriendLink>
                      )}
                    </p>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : isElly
                          ? "bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 shadow-soft"
                          : "bg-card shadow-soft border border-border"
                    )}
                  >
                    {/* Image */}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="Shared photo"
                        className="rounded-lg max-w-full max-h-[240px] object-cover mb-1"
                        loading="lazy"
                      />
                    )}
                    {isElly ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content !== '📷 Photo' && msg.content
                    )}
                  </div>

                  {/* Reactions */}
                  {user && (
                    <MessageReactions
                      messageId={msg.id}
                      reactions={reactions}
                      currentUserId={user.id}
                      onToggleReaction={toggleReaction}
                      isMe={isMe}
                    />
                  )}

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

        {ellyLoading && (
          <div className="flex gap-2 justify-start">
            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary text-[10px]">
                <Sparkles className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 shadow-soft px-4 py-3">
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
      <div className="mt-2 flex gap-2 pt-2 border-t border-border shrink-0 bg-background">
        <ChatImageUpload onImageUploaded={handleImageUploaded} />
        <EmojiPicker onEmojiSelect={insertEmoji} />
        <button
          onClick={insertEllyMention}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary hover:bg-primary/10 transition-colors"
          title="Mention Elly"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <Input
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          onFocus={handleInputFocus}
          className="flex-1 rounded-lg text-sm !text-[16px] md:!text-sm"
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
