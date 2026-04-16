import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Friend } from '@/types/planner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Sparkles, CalendarPlus, Plane } from 'lucide-react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { getElephantAvatar } from '@/lib/elephantAvatars';

const GuidedPlanSheet = lazy(() => import('@/components/plans/GuidedPlanSheet'));
const GuidedTripSheet = lazy(() => import('@/components/trips/GuidedTripSheet'));

interface GroupSchedulerProps {
  friends: Friend[];
  defaultSelectedFriendIds?: string[];
}

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

function useSuggestedFriends(connectedFriends: Friend[]) {
  const { user } = useAuth();
  const { plans } = usePlannerStore();

  return useMemo(() => {
    if (!user?.id || connectedFriends.length === 0) return connectedFriends.slice(0, 5);

    const coCount = new Map<string, number>();
    for (const plan of plans) {
      if (!plan.participants) continue;
      for (const p of plan.participants) {
        if (p.friendUserId && p.friendUserId !== user.id) {
          coCount.set(p.friendUserId, (coCount.get(p.friendUserId) || 0) + 1);
        }
      }
    }

    const scored = connectedFriends.map(f => ({
      friend: f,
      score: f.friendUserId ? (coCount.get(f.friendUserId) || 0) : 0,
    }));
    scored.sort((a, b) => b.score - a.score || a.friend.name.localeCompare(b.friend.name));

    return scored.slice(0, 5).map(s => s.friend);
  }, [user?.id, connectedFriends, plans]);
}

export function GroupScheduler({ friends, defaultSelectedFriendIds }: GroupSchedulerProps) {
  const isMobile = useIsMobile();
  const connectedFriends = friends.filter(f => f.status === 'connected');
  const [stagedFriends, setStagedFriends] = useState<Friend[]>([]);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showChoiceMenu, setShowChoiceMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);
  const [quickTripOpen, setQuickTripOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-populate selected friends
  useEffect(() => {
    if (defaultSelectedFriendIds && defaultSelectedFriendIds.length > 0 && !defaultsApplied) {
      const preSelected = connectedFriends.filter(
        f => f.friendUserId && defaultSelectedFriendIds.includes(f.friendUserId),
      );
      if (preSelected.length > 0) {
        setStagedFriends(preSelected);
        setDefaultsApplied(true);
      }
    }
  }, [defaultSelectedFriendIds, connectedFriends, defaultsApplied]);

  const suggestedFriends = useSuggestedFriends(connectedFriends);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return [];
    const stagedIds = new Set(stagedFriends.map(f => f.id));
    return connectedFriends
      .filter(f => !stagedIds.has(f.id) && f.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [searchQuery, connectedFriends, stagedFriends]);

  const visibleSuggestions = useMemo(() => {
    const stagedIds = new Set(stagedFriends.map(f => f.id));
    return suggestedFriends.filter(f => !stagedIds.has(f.id));
  }, [suggestedFriends, stagedFriends]);

  const addFriend = useCallback((friend: Friend) => {
    setStagedFriends(prev => (prev.some(f => f.id === friend.id) ? prev : [...prev, friend]));
    setSearchQuery('');
    setShowResults(false);
  }, []);

  const removeFriend = useCallback((friendId: string) => {
    setStagedFriends(prev => prev.filter(f => f.id !== friendId));
  }, []);

  const clearStaged = () => setStagedFriends([]);

  const preSelectedFriends = useMemo(
    () =>
      stagedFriends
        .filter(f => f.friendUserId)
        .map(f => ({ userId: f.friendUserId!, name: f.name, avatar: f.avatar })),
    [stagedFriends],
  );

  const handleLetsGoClick = () => setShowChoiceMenu(true);
  const handleChoosePlan = () => {
    setShowChoiceMenu(false);
    setQuickPlanOpen(true);
  };
  const handleChooseTrip = () => {
    setShowChoiceMenu(false);
    setQuickTripOpen(true);
  };

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
        const friend = connectedFriends.find(f => f.friendUserId === data.userId);
        if (friend) addFriend(friend);
      }
    } catch {}
  }, [connectedFriends, addFriend]);

  if (connectedFriends.length === 0) return null;

  const hasStaged = stagedFriends.length > 0;

  return (
    <>
      <div className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Plan with Friends
        </h2>

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
              <div className="flex w-full items-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                  onFocus={() => searchQuery.trim() && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  placeholder="Search or tap friends to plan with…"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
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
                  className="flex w-full items-center gap-2"
                >
                  <div className="flex shrink-0 -space-x-2">
                    {stagedFriends.map((f) => (
                      <motion.button
                        key={f.id}
                        layout
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        onClick={() => removeFriend(f.id)}
                        className="group relative"
                        title={`Remove ${f.name}`}
                      >
                        <Avatar className="h-7 w-7 border-2 border-background ring-1 ring-primary/20">
                          <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                          <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                            {getInitials(f.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -right-0.5 -top-0.5 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive group-hover:flex">
                          <X className="h-2 w-2 text-destructive-foreground" />
                        </span>
                      </motion.button>
                    ))}
                  </div>

                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <Search className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                      onFocus={() => searchQuery.trim() && setShowResults(true)}
                      onBlur={() => setTimeout(() => setShowResults(false), 200)}
                      placeholder="Add more…"
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLetsGoClick}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
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
                  className="absolute right-0 top-full z-50 mt-1.5 flex w-56 flex-col gap-1 overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-lg"
                >
                  <motion.button
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                    onClick={handleChoosePlan}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-150 hover:bg-accent"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: -6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10"
                    >
                      <CalendarPlus className="h-4 w-4 text-primary" />
                    </motion.div>
                    <div>
                      <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        Create a Plan
                      </p>
                      <p className="text-[10px] text-muted-foreground">Find a time to meet up</p>
                    </div>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={handleChooseTrip}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-150 hover:bg-accent"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-chart-4/20 to-chart-4/5 ring-1 ring-chart-4/10"
                    >
                      <Plane className="h-4 w-4 text-chart-4" />
                    </motion.div>
                    <div>
                      <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-chart-4">
                        Plan a Trip
                      </p>
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
                className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
              >
                {searchResults.map((friend) => (
                  <button
                    key={friend.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addFriend(friend)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
                      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                        {getInitials(friend.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium text-foreground">{friend.name}</span>
                    {friend.isPodMember && (
                      <span className="ml-auto text-[10px] font-medium text-primary">Pod</span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Suggested friends — always visible for quick adding */}
        {visibleSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested
            </span>
            {visibleSuggestions.map(friend => (
              <button
                key={friend.id}
                onClick={() => addFriend(friend)}
                className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
                  <AvatarFallback className="bg-primary/10 text-[8px] text-primary">
                    {getInitials(friend.name)}
                  </AvatarFallback>
                </Avatar>
                {friend.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {quickPlanOpen && (
        <Suspense fallback={null}>
          <GuidedPlanSheet
            open={quickPlanOpen}
            onOpenChange={(open) => {
              setQuickPlanOpen(open);
              if (!open) clearStaged();
            }}
            preSelectedFriends={preSelectedFriends}
          />
        </Suspense>
      )}

      {quickTripOpen && (
        <Suspense fallback={null}>
          <GuidedTripSheet
            open={quickTripOpen}
            onOpenChange={(open) => {
              setQuickTripOpen(open);
              if (!open) clearStaged();
            }}
            preSelectedFriends={preSelectedFriends}
          />
        </Suspense>
      )}
    </>
  );
}
