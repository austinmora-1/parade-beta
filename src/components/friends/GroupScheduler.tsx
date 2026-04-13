import { useState, useMemo, useEffect, useRef } from 'react';
import { getEffectiveCity, citiesMatch } from '@/lib/locationMatch';
import { Friend, TimeSlot, TIME_SLOT_LABELS } from '@/types/planner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { X, CalendarPlus, Users, ChevronLeft, ChevronRight, Search, Sparkles, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { useAuth } from '@/hooks/useAuth';

interface GroupSchedulerProps {
  friends: Friend[];
  defaultSelectedFriendIds?: string[];
}

interface FriendAvailability {
  userId: string;
  slots: Record<string, Record<TimeSlot, boolean>>;
  locationByDate: Record<string, { locationStatus: string; tripLocation: string | null }>;
  homeAddress: string | null;
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
    
    // Count co-participation frequency from plans
    const coCount = new Map<string, number>();
    for (const plan of plans) {
      if (!plan.participants) continue;
      for (const p of plan.participants) {
        if (p.friendUserId && p.friendUserId !== user.id) {
          coCount.set(p.friendUserId, (coCount.get(p.friendUserId) || 0) + 1);
        }
      }
    }
    
    // Sort connected friends by co-participation, then alphabetically
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

  // Pre-populate selected friends from defaultSelectedFriendIds
  useEffect(() => {
    if (defaultSelectedFriendIds && defaultSelectedFriendIds.length > 0 && !defaultsApplied) {
      const preSelected = connectedFriends.filter(f => f.friendUserId && defaultSelectedFriendIds.includes(f.friendUserId));
      if (preSelected.length > 0) {
        setSelectedFriends(preSelected);
        setDefaultsApplied(true);
      }
    }
  }, [defaultSelectedFriendIds, connectedFriends, defaultsApplied]);
  const [friendAvailabilities, setFriendAvailabilities] = useState<FriendAvailability[]>([]);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; slot: TimeSlot } | null>(null);
  const { availabilityMap: myAvailabilityMap, plans } = usePlannerStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const suggestedFriends = useSuggestedFriends(connectedFriends);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Filter friends for search dropdown (only when actively searching)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return [];
    const selectedIds = new Set(selectedFriends.map(f => f.id));
    return connectedFriends.filter(f => !selectedIds.has(f.id) && f.name.toLowerCase().includes(q));
  }, [searchQuery, connectedFriends, selectedFriends]);

  // Suggested friends (excluding already selected)
  const visibleSuggestions = useMemo(() => {
    const selectedIds = new Set(selectedFriends.map(f => f.id));
    return suggestedFriends.filter(f => !selectedIds.has(f.id));
  }, [suggestedFriends, selectedFriends]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch availability for selected friends
  useEffect(() => {
    if (selectedFriends.length === 0) {
      setFriendAvailabilities([]);
      return;
    }

    const fetchAvail = async () => {
      const userIds = selectedFriends.map(f => f.friendUserId).filter(Boolean) as string[];
      if (userIds.length === 0) return;

      const startDate = format(days[0], 'yyyy-MM-dd');
      const endDate = format(days[6], 'yyyy-MM-dd');

      const { data } = await supabase
        .from('availability')
        .select('*')
        .in('user_id', userIds)
        .gte('date', startDate)
        .lte('date', endDate);

      const avails: FriendAvailability[] = userIds.map(uid => {
        const userRows = (data || []).filter(d => d.user_id === uid);
        const slots: Record<string, Record<TimeSlot, boolean>> = {};
        for (const row of userRows) {
          slots[row.date] = {
            'early-morning': row.early_morning ?? true,
            'late-morning': row.late_morning ?? true,
            'early-afternoon': row.early_afternoon ?? true,
            'late-afternoon': row.late_afternoon ?? true,
            'evening': row.evening ?? true,
            'late-night': row.late_night ?? true,
          };
        }
        return { userId: uid, slots };
      });

      setFriendAvailabilities(avails);
    };

    fetchAvail();
  }, [selectedFriends, days]);

  const toggleFriend = (friend: Friend) => {
    setSelectedFriends(prev =>
      prev.find(f => f.id === friend.id)
        ? prev.filter(f => f.id !== friend.id)
        : [...prev, friend]
    );
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const addFriend = (friend: Friend) => {
    setSelectedFriends(prev => [...prev, friend]);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const removeFriend = (friendId: string) => {
    setSelectedFriends(prev => prev.filter(f => f.id !== friendId));
  };

  // Get combined availability status for a day/slot
  const getOverlapStatus = (date: Date, slot: TimeSlot): 'all-free' | 'some-free' | 'none-free' | 'no-data' => {
    if (selectedFriends.length === 0) return 'no-data';

    const dateStr = format(date, 'yyyy-MM-dd');

    const myDay = myAvailabilityMap[format(date, 'yyyy-MM-dd')];
    const myFree = myDay ? myDay.slots[slot] : true;
    const myBusy = plans.some(p => isSameDay(p.date, date) && p.timeSlot === slot);

    let freeCount = 0;
    let totalChecked = 0;

    for (const fa of friendAvailabilities) {
      totalChecked++;
      const daySlots = fa.slots[dateStr];
      if (!daySlots || daySlots[slot]) freeCount++;
    }

    const iAmFree = myFree && !myBusy;
    const allFriendsFree = freeCount === totalChecked;
    const someFriendsFree = freeCount > 0;

    if (iAmFree && allFriendsFree) return 'all-free';
    if (iAmFree && someFriendsFree) return 'some-free';
    return 'none-free';
  };

  const handleSlotClick = (date: Date, slot: TimeSlot) => {
    const status = getOverlapStatus(date, slot);
    if (status === 'none-free') return;
    setSelectedSlot({ date, slot });
    setCreatePlanOpen(true);
  };

  if (connectedFriends.length === 0) return null;

  const showSearchDropdown = isSearchFocused && searchQuery.trim().length > 0 && searchResults.length > 0;

  return (
    <Collapsible defaultOpen={false} className="group/hang">
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft md:p-4">
      <CollapsibleTrigger className="flex w-full items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" />
          Schedule a Hang
        </h2>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/hang:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2.5">

      {/* Selected friends chips */}
      {selectedFriends.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedFriends.map(friend => (
            <span
              key={friend.id}
              className="flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-xs font-medium"
            >
              <Avatar className="h-4 w-4">
                <AvatarImage src={friend.avatar} />
                <AvatarFallback className="text-[7px] bg-primary-foreground/20 text-primary-foreground">
                  {getInitials(friend.name)}
                </AvatarFallback>
              </Avatar>
              {friend.name.split(' ')[0]}
              <button onClick={() => removeFriend(friend.id)} className="hover:opacity-70 transition-opacity">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative" ref={searchRef}>
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search friends to schedule with..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          className="pl-8 h-8 text-xs"
        />

        {/* Search results dropdown (only when typing) */}
        {showSearchDropdown && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-md overflow-hidden">
            <div className="max-h-48 overflow-y-auto py-1">
              {searchResults.map(friend => (
                <button
                  key={friend.id}
                  onClick={() => addFriend(friend)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={friend.avatar} />
                    <AvatarFallback className={cn("text-[9px]", getAvatarColor(friend.name))}>
                      {getInitials(friend.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium truncate">{friend.name}</span>
                  {friend.isPodMember && (
                    <span className="ml-auto text-[9px] text-primary font-medium">Pod</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggested friends (always visible below search) */}
      {visibleSuggestions.length > 0 && selectedFriends.length === 0 && (
        <div className="mt-2.5">
          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <Sparkles className="h-3 w-3" />
            Suggested
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visibleSuggestions.map(friend => (
              <button
                key={friend.id}
                onClick={() => addFriend(friend)}
                className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={friend.avatar} />
                  <AvatarFallback className={cn("text-[8px]", getAvatarColor(friend.name))}>
                    {getInitials(friend.name)}
                  </AvatarFallback>
                </Avatar>
                {friend.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Availability overlay grid */}
      {selectedFriends.length > 0 && (
        <div className="space-y-2">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              {format(days[0], 'MMM d')} – {format(days[6], 'MMM d')}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="w-16 p-1 text-left text-muted-foreground font-normal" />
                  {days.map(day => (
                    <th key={day.toISOString()} className={cn(
                      "p-1 text-center font-medium min-w-[40px]",
                      isToday(day) && "text-primary"
                    )}>
                      <div>{format(day, 'EEE')}</div>
                      <div className={cn("text-sm", isToday(day) && "font-bold")}>{format(day, 'd')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map(slot => (
                  <tr key={slot}>
                    <td className="p-1 text-muted-foreground whitespace-nowrap">
                      {TIME_SLOT_LABELS[slot].time}
                    </td>
                    {days.map(day => {
                      const status = getOverlapStatus(day, slot);
                      return (
                        <td key={day.toISOString()} className="p-0.5">
                          <button
                            onClick={() => handleSlotClick(day, slot)}
                            disabled={status === 'none-free' || status === 'no-data'}
                            className={cn(
                              "w-full h-6 rounded transition-all text-[9px] font-medium",
                              status === 'all-free' && "bg-availability-available/30 hover:bg-availability-available/50 text-availability-available cursor-pointer",
                              status === 'some-free' && "bg-availability-partial/20 hover:bg-availability-partial/30 text-availability-partial cursor-pointer",
                              status === 'none-free' && "bg-muted/40 text-muted-foreground/40 cursor-not-allowed",
                              status === 'no-data' && "bg-transparent"
                            )}
                          >
                            {status === 'all-free' && '✓'}
                            {status === 'some-free' && '~'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-availability-available/30" />
              All free
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-availability-partial/20" />
              Some free
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-muted/40" />
              Unavailable
            </div>
          </div>

          {/* Create plan button */}
          <Button
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={() => {
              setSelectedSlot(null);
              setCreatePlanOpen(true);
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Create Plan with {selectedFriends.length} {selectedFriends.length === 1 ? 'friend' : 'friends'}
          </Button>
        </div>
      )}
      </CollapsibleContent>

      <CreatePlanDialog
        open={createPlanOpen}
        onOpenChange={setCreatePlanOpen}
        defaultDate={selectedSlot?.date}
      />
    </div>
    </Collapsible>
  );
}
