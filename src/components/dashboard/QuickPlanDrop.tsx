import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';

export interface StagedFriend {
  userId: string;
  name: string;
  avatar?: string;
}

interface QuickPlanDropProps {
  stagedFriends: StagedFriend[];
  onAddFriend: (friend: StagedFriend) => void;
  onRemoveFriend: (userId: string) => void;
  onClear: () => void;
}

export function QuickPlanDrop({ stagedFriends, onAddFriend, onRemoveFriend, onClear }: QuickPlanDropProps) {
  const isMobile = useIsMobile();
  const [isDragOver, setIsDragOver] = useState(false);
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/friend'));
      if (data?.userId) {
        onAddFriend(data as StagedFriend);
      }
    } catch { /* ignore invalid drops */ }
  }, [onAddFriend]);

  const hasFriends = stagedFriends.length > 0;

  return (
    <>
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        layout
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-all duration-200',
          isDragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : hasFriends
              ? 'border-primary/30 bg-primary/[0.03]'
              : 'border-muted-foreground/20 bg-card/50'
        )}
      >
        <AnimatePresence mode="wait">
          {!hasFriends ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 px-4 py-3"
            >
              <CalendarPlus className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                isDragOver ? 'text-primary' : 'text-muted-foreground/50'
              )} />
              <span className={cn(
                'text-sm transition-colors',
                isDragOver ? 'text-primary font-medium' : 'text-muted-foreground/60'
              )}>
                {isDragOver ? 'Drop to start a plan!' : 'Drag friends here to plan'}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="filled"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-3 py-2.5"
            >
              {/* Staged friend avatars */}
              <div className="flex items-center -space-x-2">
                {stagedFriends.slice(0, 5).map((friend, i) => (
                  <motion.div
                    key={friend.userId}
                    initial={{ scale: 0, x: -10 }}
                    animate={{ scale: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25, delay: i * 0.05 }}
                    className="relative group"
                  >
                    <Avatar className="h-8 w-8 border-2 border-background">
                      <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
                      <AvatarFallback className="text-[10px]">
                        {friend.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={() => onRemoveFriend(friend.userId)}
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </motion.div>
                ))}
                {stagedFriends.length > 5 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border-2 border-background text-[10px] font-medium text-muted-foreground">
                    +{stagedFriends.length - 5}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 ml-1">
                <p className="text-xs text-muted-foreground truncate">
                  {stagedFriends.map(f => f.name.split(' ')[0]).join(', ')}
                </p>
              </div>

              {/* Make a plan button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setQuickPlanOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm shrink-0"
              >
                <Sparkles className="h-3 w-3" />
                Plan
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <QuickPlanSheet
        open={quickPlanOpen}
        onOpenChange={(open) => {
          setQuickPlanOpen(open);
          if (!open) onClear();
        }}
        preSelectedFriends={stagedFriends}
      />
    </>
  );
}
