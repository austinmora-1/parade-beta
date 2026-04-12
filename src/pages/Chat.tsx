import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageCircle, Zap, Users } from 'lucide-react';
import { useConversations } from '@/hooks/useChat';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { EllyChatView } from '@/components/chat/EllyChatView';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { ReceivedVibes } from '@/components/dashboard/ReceivedVibes';
import { SentVibes } from '@/components/dashboard/SentVibes';
import { SendVibeDialog } from '@/components/vibes/SendVibeDialog';
import { FriendListRow } from '@/components/friends/FriendListRow';
import { FriendPanel } from '@/components/friends/FriendPanel';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { useLastHungOut } from '@/hooks/useLastHungOut';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { TimeSlot, VIBE_CONFIG, VibeType } from '@/types/planner';

const SLOT_KEYS: { key: string; slot: TimeSlot }[] = [
  { key: 'early_morning', slot: 'early-morning' },
  { key: 'late_morning', slot: 'late-morning' },
  { key: 'early_afternoon', slot: 'early-afternoon' },
  { key: 'late_afternoon', slot: 'late-afternoon' },
  { key: 'evening', slot: 'evening' },
  { key: 'late_night', slot: 'late-night' },
];

export default function Chat() {
  const [vibeDialogOpen, setVibeDialogOpen] = useState(false);
  const { conversations, loading, createDM, createGroup } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showElly, setShowElly] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewport = useVisualViewport();
  const [subView, setSubView] = useState<'chats' | 'people'>('chats');
  const { user } = useAuth();
  const { friends } = usePlannerStore();

  // FriendPanel state for People sub-tab
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const connectedFriends = useMemo(
    () => friends.filter(f => f.status === 'connected' && f.friendUserId),
    [friends]
  );
  const connectedFriendUserIds = useMemo(
    () => connectedFriends.map(f => f.friendUserId!),
    [connectedFriends]
  );
  const lastHungOut = useLastHungOut(connectedFriendUserIds);

  // Vibe + availability data for People list
  const [friendVibeMap, setFriendVibeMap] = useState<Record<string, { vibe: string | null; icon: string | null }>>({});
  const [friendAvailMap, setFriendAvailMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (subView !== 'people' || connectedFriendUserIds.length === 0) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    Promise.all([
      supabase.from('profiles').select('user_id, current_vibe, custom_vibe_tags').in('user_id', connectedFriendUserIds),
      supabase.from('availability').select('user_id, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night').in('user_id', connectedFriendUserIds).eq('date', todayStr),
    ]).then(([profileRes, availRes]) => {
      const vibeMap: Record<string, { vibe: string | null; icon: string | null }> = {};
      for (const p of (profileRes.data || [])) {
        const vibeConfig = p.current_vibe && p.current_vibe !== 'custom'
          ? VIBE_CONFIG[p.current_vibe as VibeType]
          : null;
        vibeMap[p.user_id] = {
          vibe: vibeConfig?.label || p.current_vibe || null,
          icon: vibeConfig?.label?.[0] || null,
        };
      }
      setFriendVibeMap(vibeMap);

      const availMap: Record<string, boolean> = {};
      for (const a of (availRes.data || [])) {
        const isAvailable = SLOT_KEYS.some(({ key }) => (a as any)[key] === true);
        availMap[a.user_id] = isAvailable;
      }
      setFriendAvailMap(availMap);
    });
  }, [subView, connectedFriendUserIds]);

  // DM conversation lookup
  const dmByFriendUserId = useMemo(() => {
    const map = new Map<string, typeof conversations[0]>();
    for (const c of conversations) {
      if (c.type !== 'dm') continue;
      const other = c.participants.find(p => p.user_id !== user?.id);
      if (other) map.set(other.user_id, c);
    }
    return map;
  }, [conversations, user?.id]);

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

  const handleOpenFriendFromPeople = (friendUserId: string, conversationId?: string) => {
    setActiveFriendId(friendUserId);
    setActiveChatId(conversationId || null);
    setPanelOpen(true);
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
            <Zap className="h-5 w-5 text-primary md:h-6 md:w-6" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold md:text-xl">Interact</h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              Vibes & messages with your friends
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setVibeDialogOpen(true)}>
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Send Vibe</span>
          </Button>
          <SendVibeDialog open={vibeDialogOpen} onOpenChange={setVibeDialogOpen} />
          <NewChatDialog onCreateDM={handleCreateDM} onCreateGroup={handleCreateGroup} />
        </div>
      </div>

      {/* Vibes sections */}
      <ReceivedVibes />
      <SentVibes />

      {/* Chats / People toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
        {(['chats', 'people'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSubView(tab)}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-medium transition-colors",
              subView === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === 'chats' ? (
              <span className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                Chats
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                People
              </span>
            )}
          </button>
        ))}
      </div>

      {subView === 'chats' ? (
        <>
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
        </>
      ) : (
        /* People sub-tab */
        <div className="space-y-0.5">
          {connectedFriends.length > 0 ? (
            connectedFriends.map(friend => {
              const fuid = friend.friendUserId!;
              return (
                <FriendListRow
                  key={friend.id}
                  friend={friend}
                  conversation={dmByFriendUserId.get(fuid) || null}
                  isAvailableToday={friendAvailMap[fuid]}
                  currentVibe={friendVibeMap[fuid]?.vibe}
                  vibeIcon={friendVibeMap[fuid]?.icon}
                  lastHungOut={lastHungOut[fuid] || null}
                  onOpen={handleOpenFriendFromPeople}
                />
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">No friends connected yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Add friends to message them!</p>
            </div>
          )}
        </div>
      )}

      {/* FriendPanel for People tab */}
      <FriendPanel
        friendUserId={activeFriendId}
        initialConversationId={activeChatId}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        defaultTab="chat"
      />
    </div>
  );
}
