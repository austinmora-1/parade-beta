import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { Friend } from '@/types/planner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Search, Sparkles, ChevronDown, CalendarPlus, Plane } from 'lucide-react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { getElephantAvatar } from '@/lib/elephantAvatars';

const GuidedPlanSheet = lazy(() => import('@/components/plans/GuidedPlanSheet'));
const GuidedTripSheet = lazy(() => import('@/components/trips/GuidedTripSheet'));

interface GroupSchedulerProps {
  friends: Friend[];
  defaultSelectedFriendIds?: string[];
}

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const avatarColors = [
  'bg-primary/20 text-primary',
  'bg-activity-drinks/20 text-activity-drinks',
  'bg-activity-sports/20 text-activity-sports',
  'bg-activity-music/20 text-activity-music',
  'bg-activity-nature/20 text-activity-nature',
];
const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

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
  const connectedFriends = friends.filter(f => f.status === 'connected');
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showChoiceMenu, setShowChoiceMenu] = useState(false);
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);
  const [quickTripOpen, setQuickTripOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Pre-populate selected friends
  useEffect(() => {
    if (defaultSelectedFriendIds && defaultSelectedFriendIds.length > 0 && !defaultsApplied) {
      const preSelected = connectedFriends.filter(
        f => f.friendUserId && defaultSelectedFriendIds.includes(f.friendUserId),
      );
      if (preSelected.length > 0) {
        setSelectedFriends(preSelected);
        setDefaultsApplied(true);
      }
    }
  }, [defaultSelectedFriendIds, connectedFriends, defaultsApplied]);

  const suggestedFriends = useSuggestedFriends(connectedFriends);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return [];
    const selectedIds = new Set(selectedFriends.map(f => f.id));
    return connectedFriends.filter(f => !selectedIds.has(f.id) && f.name.toLowerCase().includes(q));
  }, [searchQuery, connectedFriends, selectedFriends]);

  const visibleSuggestions = useMemo(() => {
    const selectedIds = new Set(selectedFriends.map(f => f.id));
    return suggestedFriends.filter(f => !selectedIds.has(f.id));
  }, [suggestedFriends, selectedFriends]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addFriend = (friend: Friend) => {
    setSelectedFriends(prev => [...prev, friend]);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const removeFriend = (friendId: string) => {
    setSelectedFriends(prev => prev.filter(f => f.id !== friendId));
  };

  const clearStaged = () => setSelectedFriends([]);

  const preSelectedFriends = useMemo(
    () =>
      selectedFriends
        .filter(f => f.friendUserId)
        .map(f => ({ userId: f.friendUserId!, name: f.name, avatar: f.avatar })),
    [selectedFriends],
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

  if (connectedFriends.length === 0) return null;

  const showSearchDropdown = isSearchFocused && searchQuery.trim().length > 0 && searchResults.length > 0;
  const hasStaged = selectedFriends.length > 0;

  return (
    <>
      <Collapsible defaultOpen={false} className="group/hang">
        <div className="rounded-xl border border-border bg-card p-3 shadow-soft md:p-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" />
              Plan with Friends
            </h2>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/hang:rotate-180" />
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2.5">
            {/* Selected friends chips */}
            {hasStaged && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {selectedFriends.map(friend => (
                  <span
                    key={friend.id}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
                      <AvatarFallback className="bg-primary-foreground/20 text-[7px] text-primary-foreground">
                        {getInitials(friend.name)}
                      </AvatarFallback>
                    </Avatar>
                    {friend.name.split(' ')[0]}
                    <button
                      onClick={() => removeFriend(friend.id)}
                      className="transition-opacity hover:opacity-70"
                      aria-label={`Remove ${friend.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input + Let's Go */}
            <div className="relative flex items-center gap-2" ref={searchRef}>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={hasStaged ? 'Add more…' : 'Search friends to plan with…'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  className="h-8 pl-8 text-xs"
                />

                {showSearchDropdown && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                    <div className="max-h-48 overflow-y-auto py-1">
                      {searchResults.map(friend => (
                        <button
                          key={friend.id}
                          onClick={() => addFriend(friend)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
                            <AvatarFallback className={cn('text-[9px]', getAvatarColor(friend.name))}>
                              {getInitials(friend.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs font-medium">{friend.name}</span>
                          {friend.isPodMember && (
                            <span className="ml-auto text-[9px] font-medium text-primary">Pod</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {hasStaged && (
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLetsGoClick}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
                  >
                    <Sparkles className="h-3 w-3" />
                    Let's Go
                  </motion.button>

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
                </div>
              )}
            </div>

            {/* Suggested friends */}
            {visibleSuggestions.length > 0 && !hasStaged && (
              <div className="mt-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  Suggested
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleSuggestions.map(friend => (
                    <button
                      key={friend.id}
                      onClick={() => addFriend(friend)}
                      className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
                        <AvatarFallback className={cn('text-[8px]', getAvatarColor(friend.name))}>
                          {getInitials(friend.name)}
                        </AvatarFallback>
                      </Avatar>
                      {friend.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

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
