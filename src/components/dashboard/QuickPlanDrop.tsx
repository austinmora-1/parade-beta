import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, X, Sparkles, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GuidedPlanSheet } from '@/components/plans/GuidedPlanSheet';
import { usePlannerStore } from '@/stores/plannerStore';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { friends } = usePlannerStore();

  const connectedFriends = useMemo(() =>
    friends.filter(f => f.status === 'connected' && f.friendUserId),
    [friends]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return connectedFriends
      .filter(f =>
        f.name.toLowerCase().includes(q) &&
        !stagedFriends.some(s => s.userId === f.friendUserId)
      )
      .slice(0, 6);
  }, [searchQuery, connectedFriends, stagedFriends]);

  const handleSelectResult = useCallback((friend: typeof connectedFriends[0]) => {
    onAddFriend({
      userId: friend.friendUserId!,
      name: friend.name,
      avatar: friend.avatar,
    });
    setSearchQuery('');
    setShowResults(false);
  }, [onAddFriend]);

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
      <div ref={containerRef} className="relative z-20">
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
                className="flex items-center gap-2 px-3 py-2"
              >
                <Search className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isDragOver ? 'text-primary' : 'text-muted-foreground/50'
                )} />
                {isDragOver ? (
                  <span className="text-sm text-primary font-medium">
                    Drop to start a plan!
                  </span>
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => searchQuery.trim() && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    placeholder="Search or tap friends to plan with…"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                  />
                )}
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
                      className="relative group cursor-pointer"
                      onClick={() => onRemoveFriend(friend.userId)}
                    >
                      <Avatar className="h-8 w-8 border-2 border-background group-hover:opacity-0 transition-opacity duration-150">
                        <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
                        <AvatarFallback className="text-[10px]">
                          {friend.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <X className="h-3.5 w-3.5" />
                      </div>
                    </motion.div>
                  ))}
                  {stagedFriends.length > 5 && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border-2 border-background text-[10px] font-medium text-muted-foreground">
                      +{stagedFriends.length - 5}
                    </div>
                  )}
                </div>

                {/* Inline search when friends are staged */}
                <div className="flex-1 min-w-0 ml-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => searchQuery.trim() && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    placeholder="Add more…"
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
                  />
                </div>

                {/* Make a plan button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setQuickPlanOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm shrink-0"
                >
                  <Sparkles className="h-3 w-3" />
                  Let's Plan
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Search results dropdown */}
        <AnimatePresence>
          {showResults && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
            >
              {searchResults.map((friend) => (
                <button
                  key={friend.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectResult(friend)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {friend.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground truncate">{friend.name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GuidedPlanSheet
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