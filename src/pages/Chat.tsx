import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { useConversations } from '@/hooks/useChat';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { EllyChatView } from '@/components/chat/EllyChatView';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVisualViewport } from '@/hooks/useVisualViewport';

export default function Chat() {
  const { conversations, loading, createDM, createGroup } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showElly, setShowElly] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewportHeight = useVisualViewport();

  // Open Elly if navigated with ?elly=true
  useEffect(() => {
    if (searchParams.get('elly') === 'true') {
      setShowElly(true);
      setActiveId(null);
      // Clean up the URL param
      searchParams.delete('elly');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const activeConvo = conversations.find(c => c.id === activeId) || null;

  const handleCreateDM = async (friendUserId: string) => {
    const id = await createDM(friendUserId);
    if (id) setActiveId(id);
    return id;
  };

  const handleCreateGroup = async (title: string, memberIds: string[]) => {
    const id = await createGroup(title, memberIds);
    if (id) setActiveId(id);
    return id;
  };

  const handleSelectElly = () => {
    setShowElly(true);
    setActiveId(null);
  };

  const handleSelectConvo = (id: string) => {
    setActiveId(id);
    setShowElly(false);
  };

  // Elly full chat view
  // Use visual viewport height when available (keyboard-aware), fallback to dvh
  const chatStyle = viewportHeight
    ? { height: `${viewportHeight - 112}px` }
    : undefined;
  const chatClass = viewportHeight
    ? "animate-fade-in"
    : "animate-fade-in h-[calc(100dvh-7rem)] md:h-[calc(100dvh-8rem)]";

  if (showElly) {
    return (
      <div className={chatClass} style={chatStyle}>
        <EllyChatView onBack={() => setShowElly(false)} />
      </div>
    );
  }

  // Active conversation view (full screen on mobile)
  if (activeConvo) {
    return (
      <div className={chatClass} style={chatStyle}>
        <ChatView conversation={activeConvo} onBack={() => setActiveId(null)} />
      </div>
    );
  }

  // Conversation list with pinned Elly
  return (
    <div className="animate-fade-in space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 md:h-12 md:w-12 md:rounded-2xl">
            <MessageCircle className="h-5 w-5 text-primary md:h-6 md:w-6" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold md:text-xl">Messages</h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              Chat with friends about plans
            </p>
          </div>
        </div>
        <NewChatDialog onCreateDM={handleCreateDM} onCreateGroup={handleCreateGroup} />
      </div>

      {/* List */}
      <div className="rounded-xl border border-border bg-card/50 p-3 md:rounded-2xl md:p-4">
        {/* Pinned Elly conversation */}
        <button
          onClick={handleSelectElly}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all mb-1",
            "hover:bg-accent border border-transparent",
            "bg-gradient-to-r from-primary/5 to-transparent"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Elly</span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase tracking-wide">
                AI
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              Your planning assistant — create & manage plans
            </p>
          </div>
        </button>

        {/* Divider */}
        {conversations.length > 0 && (
          <div className="my-2 border-t border-border" />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground animate-pulse">Loading chats...</p>
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={handleSelectConvo}
          />
        )}
      </div>
    </div>
  );
}
