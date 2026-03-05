import { useState, useEffect } from 'react';
import { Sparkles, MessageCircle } from 'lucide-react';
import { useConversations } from '@/hooks/useChat';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { EllyChatView } from '@/components/chat/EllyChatView';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useVisualViewport } from '@/hooks/useVisualViewport';

export default function Chat() {
  const { conversations, loading, createDM, createGroup } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showElly, setShowElly] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewport = useVisualViewport();

  const mobileOverlayStyle = viewport
    ? { height: `${viewport.height}px`, top: `${viewport.offsetTop}px` }
    : { height: '100dvh', top: 0 };

  // Open Elly if navigated with ?elly=true, or specific conversation
  useEffect(() => {
    if (searchParams.get('elly') === 'true') {
      setShowElly(true);
      setActiveId(null);
      searchParams.delete('elly');
      setSearchParams(searchParams, { replace: true });
    }
    const conversationParam = searchParams.get('conversation');
    if (conversationParam) {
      setActiveId(conversationParam);
      setShowElly(false);
      searchParams.delete('conversation');
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

  // Fixed overlay for active chat/Elly
  if (showElly) {
    return (
      <div
        className="animate-fade-in fixed inset-x-0 z-[60] flex flex-col bg-background pb-[env(safe-area-inset-bottom)] md:relative md:inset-auto md:z-auto md:h-[calc(100dvh-8rem)] md:pb-0"
        style={window.innerWidth < 768 ? mobileOverlayStyle : undefined}
      >
        <div className="flex-1 min-h-0 overflow-hidden px-4 pt-14 md:px-0 md:pt-0">
          <EllyChatView onBack={() => setShowElly(false)} />
        </div>
      </div>
    );
  }

  if (activeConvo) {
    return (
      <div
        className="animate-fade-in fixed inset-x-0 z-[60] flex flex-col bg-background pb-[env(safe-area-inset-bottom)] md:relative md:inset-auto md:z-auto md:h-[calc(100dvh-8rem)] md:pb-0"
        style={window.innerWidth < 768 ? mobileOverlayStyle : undefined}
      >
        <div className="flex-1 min-h-0 overflow-hidden px-4 pt-14 md:px-0 md:pt-0">
          <ChatView conversation={activeConvo} onBack={() => setActiveId(null)} />
        </div>
      </div>
    );
  }

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
              Chat with your friends
            </p>
          </div>
        </div>
        <NewChatDialog onCreateDM={handleCreateDM} onCreateGroup={handleCreateGroup} />
      </div>

      {/* Elly pinned */}
      <button
        onClick={handleSelectElly}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
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
            Your planning assistant
          </p>
        </div>
      </button>

      {conversations.length > 0 && (
        <div className="border-t border-border" />
      )}

      {/* Conversation list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </div>
      ) : (
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelectConvo}
        />
      )}
    </div>
  );
}
