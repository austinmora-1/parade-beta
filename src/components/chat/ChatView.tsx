import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatMessages, Conversation } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ArrowLeft, Users, Check, CheckCheck, Sparkles, Loader2, Reply } from 'lucide-react';
import { FriendLink } from '@/components/ui/FriendLink';
import { SignedImage } from '@/components/ui/SignedImage';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { ELLY_USER_ID } from '@/lib/constants';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { MessageReactions } from './MessageReactions';
import { ChatAttachMenu } from './ChatAttachMenu';
import { MessageActions } from './MessageActions';
import { ReplyPreview } from './ReplyPreview';
import { ChatMessage } from '@/hooks/useChat';

interface ChatViewProps {
  conversation: Conversation;
  onBack: () => void;
  inlineMode?: boolean;
}

export function ChatView({ conversation, onBack, inlineMode = false }: ChatViewProps) {
  const { user } = useAuth();
  const { loadPlans } = usePlannerStore();
  const { messages, loading, loadingMore, hasMore, loadMore, sendMessage, editMessage, deleteMessage, readReceipts, reactions, toggleReaction } = useChatMessages(conversation.id);
  const [input, setInput] = useState('');
  const [ellyLoading, setEllyLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputFocus = () => {
    // Let mobile browsers handle focus without forcing a viewport jump
  };

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || loadingMore || !hasMore) return;
    if (container.scrollTop < 100) {
      const prevHeight = container.scrollHeight;
      loadMore().then(() => {
        // Preserve scroll position after prepending older messages
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [loadMore, loadingMore, hasMore]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const replyId = replyTo?.id;
    setReplyTo(null);
    await sendMessage(text, undefined, replyId);

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
          await loadPlans();
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

  const handleGifSelected = async (gifUrl: string) => {
    await sendMessage('', gifUrl);
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

  const handleReply = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      setReplyTo(msg);
      inputRef.current?.focus();
    }
  };

  const getReplyMessage = (replyToId: string | null) => {
    if (!replyToId) return null;
    return messages.find(m => m.id === replyToId) || null;
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/5');
      setTimeout(() => el.classList.remove('bg-primary/5'), 1500);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Fixed Header */}
      <div className="z-20 shrink-0 bg-background flex items-center gap-3 border-b border-border pb-3 mb-3 min-w-0">
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
      <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2" onScroll={handleScroll} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
        <div className="flex flex-col justify-end min-h-full space-y-3">
        {loadingMore && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
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
                id={`msg-${msg.id}`}
                className={cn("flex gap-2 group transition-colors duration-500 rounded-lg", isMe ? "justify-end" : "justify-start")}
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
                  <div className="flex items-start gap-1">
                    {isMe && (
                      <MessageActions
                        messageId={msg.id}
                        content={msg.content}
                        isMe={isMe}
                        hasImage={!!msg.image_url}
                        onEdit={editMessage}
                        onDelete={deleteMessage}
                        onReply={handleReply}
                      />
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
                      {/* Reply quote */}
                      {msg.reply_to_id && (() => {
                        const repliedMsg = getReplyMessage(msg.reply_to_id);
                        if (!repliedMsg) return null;
                        const replySender = participantMap.get(repliedMsg.sender_id);
                        return (
                          <ReplyPreview
                            senderName={replySender?.display_name || 'Unknown'}
                            senderId={repliedMsg.sender_id}
                            content={repliedMsg.content}
                            inline
                            onClick={() => scrollToMessage(repliedMsg.id)}
                          />
                        );
                      })()}
                      {/* Image */}
                      {msg.image_url && (
                        <SignedImage
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
                    {!isMe && (
                      <MessageActions
                        messageId={msg.id}
                        content={msg.content}
                        isMe={false}
                        hasImage={!!msg.image_url}
                        onEdit={editMessage}
                        onDelete={deleteMessage}
                        onReply={handleReply}
                      />
                    )}
                  </div>

                  {/* Edited indicator */}
                  {msg.edited_at && (
                    <span className={cn(
                      "text-[9px] text-muted-foreground/50 ml-1",
                      isMe ? "text-right block" : ""
                    )}>
                      (edited)
                    </span>
                  )}

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

      {/* Reply banner */}
      {replyTo && (
        <div className="mt-2 shrink-0">
          <ReplyPreview
            senderName={participantMap.get(replyTo.sender_id)?.display_name || 'Unknown'}
            senderId={replyTo.sender_id}
            content={replyTo.content}
            onClear={() => setReplyTo(null)}
          />
        </div>
      )}

      {/* Input */}
      <div className={cn("flex gap-2 border-t border-border bg-background pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shrink-0", !replyTo && "mt-2")}>
        <ChatAttachMenu
          onImageUploaded={handleImageUploaded}
          onGifSelected={handleGifSelected}
          onEmojiSelect={insertEmoji}
          onEllyMention={insertEllyMention}
        />
        <Input
          ref={inputRef}
          placeholder={replyTo ? "Reply..." : "Type a message..."}
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
