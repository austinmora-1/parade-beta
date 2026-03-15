import { useState } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ChatView } from '@/components/chat/ChatView';
import { useConversations, Conversation } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';
import { FriendAvatarGrid } from './FriendAvatarGrid';
import { GroupScheduler } from './GroupScheduler';
import { Pod } from '@/hooks/usePods';
import { Friend } from '@/types/planner';

interface PodPanelProps {
  pod: Pod | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friends: Friend[];
  onUpdatePod?: (podId: string, updates: { conversation_id?: string }) => void;
  onOpenFriend?: (friendUserId: string) => void;
  onRemoveFriend?: (id: string) => void;
}

function GroupChatEmptyState({
  pod,
  onConversationCreated,
}: {
  pod: Pod;
  onConversationCreated: (conversationId: string) => void;
}) {
  const { createGroup } = useConversations();
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    const id = await createGroup(pod.name, pod.memberUserIds);
    if (id) {
      await supabase.from('pods').update({ conversation_id: id } as any).eq('id', pod.id);
      onConversationCreated(id);
    }
    setStarting(false);
  };

  return (
    <div className="flex flex-col h-full items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <MessageCircle className="h-7 w-7 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium">{pod.emoji} {pod.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Start a group chat with your pod</p>
      </div>
      <Button onClick={handleStart} disabled={starting} size="sm" className="gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" />
        Start Group Chat
      </Button>
    </div>
  );
}

function PodPanelContent({
  pod,
  friends,
  onClose,
  onUpdatePod,
  onOpenFriend,
  onRemoveFriend,
  onTabChange,
}: {
  pod: Pod;
  friends: Friend[];
  onClose: () => void;
  onUpdatePod?: (podId: string, updates: { conversation_id?: string }) => void;
  onOpenFriend?: (friendUserId: string) => void;
  onRemoveFriend?: (id: string) => void;
  onTabChange?: (tab: 'members' | 'chat') => void;
}) {
  const [activeTab, setActiveTab] = useState<'members' | 'chat'>('members');

  const handleTabChange = (tab: 'members' | 'chat') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };
  const { conversations } = useConversations();
  const [conversationId, setConversationId] = useState<string | null>(pod.conversationId || null);

  const activeConversation: Conversation | null = conversations.find(c => c.id === conversationId) || null;

  const podFriends = friends.filter(f => f.status === 'connected' && f.friendUserId && pod.memberUserIds.includes(f.friendUserId));

  const handleConversationCreated = (id: string) => {
    setConversationId(id);
    onUpdatePod?.(pod.id, { conversation_id: id });
    setActiveTab('chat');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{pod.emoji}</span>
          <span className="font-display text-sm font-semibold">{pod.name}</span>
          <span className="text-xs text-muted-foreground">({pod.memberUserIds.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {(['members', 'chat'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === 'members' ? 'Members' : 'Chat'}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'members' ? (
          <div className="p-4 space-y-4">
            {podFriends.length > 0 ? (
              <FriendAvatarGrid
                friends={podFriends}
                onRemove={onRemoveFriend || (() => {})}
              />
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No members in this pod yet</p>
            )}

            {/* Group Scheduler pre-populated */}
            <GroupScheduler
              friends={friends}
              defaultSelectedFriendIds={pod.memberUserIds}
            />
          </div>
        ) : activeConversation ? (
          <div className="h-full px-4 pt-2 pb-0">
            <ChatView
              conversation={activeConversation}
              onBack={onClose}
              inlineMode
            />
          </div>
        ) : (
          <GroupChatEmptyState
            pod={pod}
            onConversationCreated={handleConversationCreated}
          />
        )}
      </div>
    </div>
  );
}

export function PodPanel({ pod, open, onOpenChange, friends, onUpdatePod, onOpenFriend, onRemoveFriend }: PodPanelProps) {
  const isMobile = useIsMobile();

  if (!pod) return null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[92dvh] flex flex-col">
          <PodPanelContent
            pod={pod}
            friends={friends}
            onClose={() => onOpenChange(false)}
            onUpdatePod={onUpdatePod}
            onOpenFriend={onOpenFriend}
            onRemoveFriend={onRemoveFriend}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] bg-background border-l border-border shadow-xl z-50 flex flex-col"
          >
            <PodPanelContent
              pod={pod}
              friends={friends}
              onClose={() => onOpenChange(false)}
              onUpdatePod={onUpdatePod}
              onOpenFriend={onOpenFriend}
              onRemoveFriend={onRemoveFriend}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
