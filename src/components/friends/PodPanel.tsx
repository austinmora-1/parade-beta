import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
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

function PodPanelContent({
  pod,
  friends,
  onClose,
  onOpenFriend,
  onRemoveFriend,
}: {
  pod: Pod;
  friends: Friend[];
  onClose: () => void;
  onOpenFriend?: (friendUserId: string) => void;
  onRemoveFriend?: (id: string) => void;
}) {
  const podFriends = friends.filter(f => f.status === 'connected' && f.friendUserId && pod.memberUserIds.includes(f.friendUserId));

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{pod.emoji}</span>
          <span className="font-display text-sm font-semibold">{pod.name}</span>
          <span className="text-xs text-muted-foreground">({pod.memberUserIds.length})</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
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
              onOpenFriend={onOpenFriend}
              onRemoveFriend={onRemoveFriend}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
