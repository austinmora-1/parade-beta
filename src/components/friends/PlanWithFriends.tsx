import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, Plane, Search, Sparkles, X, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Friend } from '@/types/planner';
import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { getElephantAvatar } from '@/lib/elephantAvatars';

const GuidedPlanSheet = lazy(() =>
  import('@/components/plans/GuidedPlanSheet').then((m) => ({ default: m.GuidedPlanSheet })),
);
const GuidedTripSheet = lazy(() =>
  import('@/components/trips/GuidedTripSheet').then((m) => ({ default: m.GuidedTripSheet })),
);

interface PlanWithFriendsProps {
  friends: Friend[];
}

interface StagedFriend {
  userId: string;
  name: string;
  avatar?: string;
}

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

export function PlanWithFriends({ friends }: PlanWithFriendsProps) {
  const connectedFriends = useMemo(() => friends.filter(f => f.status === 'connected'), [friends]);
  const [staged, setStaged] = useState<StagedFriend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showChoiceMenu, setShowChoiceMenu] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestedFriends = useSuggestedFriends(connectedFriends);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return connectedFriends
      .filter(f => f.name.toLowerCase().includes(q))
      .filter(f => !staged.some(sf => sf.userId === (f.friendUserId || f.id)))
      .slice(0, 5);
  }, [searchQuery, connectedFriends, staged]);

  const visibleSuggestions = useMemo(() => {
    return suggestedFriends.filter(f => !staged.some(sf => sf.userId === (f.friendUserId || f.id)));
  }, [suggestedFriends, staged]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setShowChoiceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (connectedFriends.length === 0) return null;

  const addStaged = (friend: Friend) => {
    setStaged(prev => [...prev, {
      userId: friend.friendUserId || friend.id,
      name: friend.name,
      avatar: friend.avatar,
    }]);
    setSearchQuery('');
    setShowResults(false);
  };

  const removeStaged = (userId: string) => {
    setStaged(prev => prev.filter(s => s.userId !== userId));
  };

  const clearStaged = () => setStaged([]);

  const hasStaged = staged.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft md:p-4">
      <h2 className="mb-2.5 flex items-center gap-2 font-display text-sm font-semibold">
        <Users className="h-4 w-4 text-primary" />
        Plan with Friends
      </h2>

      <div ref={containerRef} className="relative">
        <motion.div
          layout
          className={cn(
            'relative flex items-center rounded-2xl border px-3 py-2 transition-colors',
            hasStaged ? 'border-primary/30 bg-primary/[0.04]' : 'border-border bg-card/60',
          )}
        >
          {!hasStaged && (
            <div className="flex items-center gap-2 w-full">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                onFocus={() => searchQuery.trim() && setShowResults(true)}
                placeholder="Search or tap friends to plan with…"
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none text-sm"
              />
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {hasStaged && (
              <motion.div
                key="staged"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex items-center gap-2 w-full"
              >
                <div className="flex -space-x-2 shrink-0">
                  {staged.map((f) => (
                    <motion.button
                      key={f.userId}
                      layout
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      onClick={() => removeStaged(f.userId)}
                      className="relative group"
                      title={`Remove ${f.name}`}
                    >
                      <Avatar className="h-7 w-7 border-2 border-background ring-1 ring-primary/20">
                        <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{f.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="absolute -top-0.5 -right-0.5 hidden group-hover:flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive">
                        <X className="h-2 w-2 text-destructive-foreground" />
                      </span>
                    </motion.button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Search className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                    onFocus={() => searchQuery.trim() && setShowResults(true)}
                    placeholder="Add more…"
                    className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none text-sm"
                  />
                </div>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowChoiceMenu(true)}
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
                  onClick={() => { setShowChoiceMenu(false); setPlanOpen(true); }}
                  className="group flex w-full items-center gap-3 px-3 py-3 text-left rounded-lg hover:bg-accent transition-all duration-150"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: -6 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10"
                  >
                    <CalendarPlus className="h-4 w-4 text-primary" />
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
                  onClick={() => { setShowChoiceMenu(false); setTripOpen(true); }}
                  className="group flex w-full items-center gap-3 px-3 py-3 text-left rounded-lg hover:bg-accent transition-all duration-150"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 6 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-chart-4/20 to-chart-4/5 ring-1 ring-chart-4/10"
                  >
                    <Plane className="h-4 w-4 text-chart-4" />
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
                  onClick={() => addStaged(friend)}
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

      {/* Suggested friends */}
      {visibleSuggestions.length > 0 && (
        <div className="mt-2.5">
          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <Sparkles className="h-3 w-3" />
            Suggested
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visibleSuggestions.map(friend => (
              <button
                key={friend.id}
                onClick={() => addStaged(friend)}
                className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                    {friend.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {friend.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {planOpen && (
        <Suspense fallback={null}>
          <GuidedPlanSheet
            open={planOpen}
            onOpenChange={(open) => {
              setPlanOpen(open);
              if (!open) clearStaged();
            }}
            preSelectedFriends={staged}
          />
        </Suspense>
      )}

      {tripOpen && (
        <Suspense fallback={null}>
          <GuidedTripSheet
            open={tripOpen}
            onOpenChange={(open) => {
              setTripOpen(open);
              if (!open) clearStaged();
            }}
            preSelectedFriends={staged}
          />
        </Suspense>
      )}
    </div>
  );
}
