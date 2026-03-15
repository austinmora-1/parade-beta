/**
 * Inbox — unified destination for messages + notifications.
 *
 * Chat tab:   full conversation list + Elly (replaces /chat on mobile nav)
 * Updates tab: links through to /notifications (keeps that page as the rich
 *              notification surface rather than embedding + duplicating its header)
 *
 * Both /chat and /notifications remain as valid routes for backward-compat
 * (push notification deep links, etc.) — this page is additive.
 */
import { useState, useEffect } from 'react';
import { Sparkles, MessageCircle, Bell, ChevronRight, UserPlus, Calendar, Inbox as InboxIcon } from 'lucide-react';
import { useConversations } from '@/hooks/useChat';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { EllyChatView } from '@/components/chat/EllyChatView';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useNotifications } from '@/hooks/useNotifications';

type InboxTab = 'chat' | 'updates';

// Summary rows for the Updates tab — tappable cards that navigate to /notifications
function UpdatesSummary({
  totalNotifications,
  incomingFriendRequests,
}: {
  totalNotifications: number;
  incomingFriendRequests: number;
}) {
  const navigate = useNavigate();

  const sections = [
    {
      icon: UserPlus,
      label: 'Friend requests',
      count: incomingFriendRequests,
      color: 'text-primary',
      bg: 'bg-primary/8',
    },
    {
      icon: Calendar,
      label: 'Plan invites & changes',
      count: Math.max(0, totalNotifications - incomingFriendRequests),
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/8',
    },
  ].filter(s => s.count > 0);

  if (totalNotifications === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <InboxIcon className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">All caught up</p>
          <p className="text-xs text-muted-foreground mt-0.5">No new updates right now</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((s) => (
        <button
          key={s.label}
          onClick={() => navigate('/notifications')}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
        >
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', s.bg)}>
            <s.icon className={cn('h-4 w-4', s.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{s.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
              {s.count}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </button>
      ))}

      <button
        onClick={() => navigate('/notifications')}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
      >
        View all updates
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Inbox() {
  const { conversations, loading, createDM, createGroup } = useConversations();
  const { totalNotifications, incomingRequestsCount } = useNotifications();

  const unreadChats = conversations.filter(c => c.unread_count > 0).length;
  const inboxCount  = totalNotifications + unreadChats;

  // incomingRequestsCount is the live friend request count from useNotifications
  const incomingFriendRequests = incomingRequestsCount;

  const [activeTab, setActiveTab] = useState<InboxTab>('chat');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showElly, setShowElly] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewport = useVisualViewport();

  const mobileOverlayStyle = viewport
    ? { height: `${viewport.height}px`, top: `${viewport.offsetTop}px` }
    : { height: '100dvh', top: 0 };

  useEffect(() => {
    if (searchParams.get('elly') === 'true') {
      setShowElly(true);
      setActiveId(null);
      setActiveTab('chat');
      searchParams.delete('elly');
      setSearchParams(searchParams, { replace: true });
    }
    const conversationParam = searchParams.get('conversation');
    if (conversationParam) {
      setActiveId(conversationParam);
      setShowElly(false);
      setActiveTab('chat');
      searchParams.delete('conversation');
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get('tab') === 'updates') {
      setActiveTab('updates');
      searchParams.delete('tab');
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

  // Full-screen chat overlay — same pattern as Chat.tsx
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
    <div className="animate-fade-in space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold md:text-2xl">Inbox</h1>
        {activeTab === 'chat' && (
          <NewChatDialog onCreateDM={handleCreateDM} onCreateGroup={handleCreateGroup} />
        )}
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-xl border border-border bg-muted/40 p-0.5 gap-0.5">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-sm font-medium transition-all duration-150',
            activeTab === 'chat'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageCircle className="h-4 w-4" strokeWidth={activeTab === 'chat' ? 2.2 : 1.8} />
          Chat
          {unreadChats > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unreadChats > 9 ? '9+' : unreadChats}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('updates')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-sm font-medium transition-all duration-150',
            activeTab === 'updates'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Bell className="h-4 w-4" strokeWidth={activeTab === 'updates' ? 2.2 : 1.8} />
          Updates
          {totalNotifications > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {totalNotifications > 9 ? '9+' : totalNotifications}
            </span>
          )}
        </button>
      </div>

      {/* ── Chat tab ── */}
      {activeTab === 'chat' && (
        <>
          {/* Elly pinned */}
          <button
            onClick={() => setShowElly(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-accent border border-transparent bg-gradient-to-r from-primary/5 to-transparent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Elly</span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary uppercase tracking-wide">AI</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">Your planning assistant</p>
            </div>
          </button>

          {conversations.length > 0 && <div className="border-t border-border" />}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={(id) => { setActiveId(id); setShowElly(false); }}
            />
          )}
        </>
      )}

      {/* ── Updates tab ── */}
      {activeTab === 'updates' && (
        <UpdatesSummary
          totalNotifications={totalNotifications}
          incomingFriendRequests={incomingFriendRequests}
        />
      )}
    </div>
  );
}
