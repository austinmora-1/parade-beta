import { useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, X, Sparkles, Search, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePlannerStore } from '@/stores/plannerStore';

const GuidedPlanSheet = lazy(() => import('@/components/plans/GuidedPlanSheet'));
const GuidedTripSheet = lazy(() => import('@/components/trips/GuidedTripSheet'));

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
  const [quickTripOpen, setQuickTripOpen] = useState(false);
  const [showChoiceMenu, setShowChoiceMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { friends } = usePlannerStore();
  const connectedFriends = useMemo(
    () => friends.filter(f => f.status === 'connected'),
    [friends],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return connectedFriends
      .filter(f => f.name.toLowerCase().includes(q))
      .filter(f => !stagedFriends.some(sf => sf.userId === f.friendUserId))
      .slice(0, 5)
      .map(f => ({
        id: f.id,
        userId: f.friendUserId || f.id,
        name: f.name,
        avatar: f.avatar,
      }));
  }, [searchQuery, connectedFriends, stagedFriends]);

  const handleSelectResult = useCallback((friend: { userId: string; name: string; avatar?: string }) => {
    onAddFriend({ userId: friend.userId, name: friend.name, avatar: friend.avatar });
    setSearchQuery('');
    setShowResults(false);
  }, [onAddFriend]);

  // Desktop drag handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data?.userId && data?.name) {
        onAddFriend({ userId: data.userId, name: data.name, avatar: data.avatar });
      }
    } catch {}
  }, [onAddFriend]);

  const hasStaged = stagedFriends.length > 0;

  const handleLetsGoClick = () => {
    setShowChoiceMenu(true);
  };

  const handleChoosePlan = () => {
    setShowChoiceMenu(false);
    setQuickPlanOpen(true);
  };

  const handleChooseTrip = () => {
    setShowChoiceMenu(false);
    setQuickTripOpen(true);
  };

  return (
    <>
      <div
        className="relative"
        onDragOver={!isMobile ? handleDragOver : undefined}
        onDragLeave={!isMobile ? handleDragLeave : undefined}
        onDrop={!isMobile ? handleDrop : undefined}
      >
        <motion.div
          layout
          className={cn(
            'relative flex items-center rounded-2xl border px-3 py-2 transition-colors',
            isDragOver
              ? 'border-primary bg-primary/5'
              : hasStaged
                ? 'border-primary/30 bg-primary/[0.04]'
                : 'border-border bg-card/60',
          )}
        >
          {/* Empty state */}
          {!hasStaged && (
            <div className="flex items-center gap-2 w-full">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                onFocus={() => searchQuery.trim() && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                placeholder="Search or tap friends to plan with…"
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none text-sm"
              />
            </div>
          )}

          {/* Staged friends */}
          <AnimatePresence mode="popLayout">
            {hasStaged && (
              <motion.div
                key="staged"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex items-center gap-2 w-full"
              >
                {/* Avatar stack */}
                <div className="flex -space-x-2 shrink-0">
                  {stagedFriends.map((f) => (
                    <motion.button
                      key={f.userId}
                      layout
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      onClick={() => onRemoveFriend(f.userId)}
                      className="relative group"
                      title={`Remove ${f.name}`}
                    >
                      <Avatar className="h-7 w-7 border-2 border-background ring-1 ring-primary/20">
                        <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">{f.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -top-0.5 -right-0.5 hidden group-hover:flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive">
                        <X className="h-2 w-2 text-destructive-foreground" />
                      </span>
                    </motion.button>
                  ))}
                </div>

                {/* Inline search */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Search className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                    onFocus={() => searchQuery.trim() && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    placeholder="Add more…"
                    className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none text-sm"
                  />
                </div>

                {/* Let's Go button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLetsGoClick}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm shrink-0"
                >
                  <Sparkles className="h-3 w-3" />
                  Let's Go
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Choice menu popover */}
        <AnimatePresence>
          {showChoiceMenu && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setShowChoiceMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-border bg-popover shadow-lg overflow-hidden p-1.5 flex flex-col gap-1"
              >
                <motion.button
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  onClick={handleChoosePlan}
                  className="group flex w-full items-center gap-3 px-3 py-3 text-left rounded-lg hover:bg-accent transition-all duration-150"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: -6 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10"
                  >
                    <CalendarPlus className="h-4.5 w-4.5 text-primary" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Create a Plan</p>
                    <p className="text-[10px] text-muted-foreground">Find a time to meet up</p>
                  </div>
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  onClick={handleChooseTrip}
                  className="group flex w-full items-center gap-3 px-3 py-3 text-left rounded-lg hover:bg-accent transition-all duration-150"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 6 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-chart-4/20 to-chart-4/5 ring-1 ring-chart-4/10"
                  >
                    <Plane className="h-4.5 w-4.5 text-chart-4" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-chart-4 transition-colors">Plan a Trip</p>
                    <p className="text-[10px] text-muted-foreground">Find the best weekend</p>
                  </div>
                </motion.button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

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
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
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

      {quickPlanOpen && (
        <Suspense fallback={null}>
          <GuidedPlanSheet
            open={quickPlanOpen}
            onOpenChange={(open) => {
              setQuickPlanOpen(open);
              if (!open) onClear();
            }}
            preSelectedFriends={stagedFriends}
          />
        </Suspense>
      )}

      {quickTripOpen && (
        <Suspense fallback={null}>
          <GuidedTripSheet
            open={quickTripOpen}
            onOpenChange={(open) => {
              setQuickTripOpen(open);
              if (!open) onClear();
            }}
            preSelectedFriends={stagedFriends}
          />
        </Suspense>
      )}
    </>
  );
}
