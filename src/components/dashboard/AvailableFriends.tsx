import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isSameDay, format, addDays, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { Friend } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight, Loader2 } from 'lucide-react';
import { CollapsibleWidget } from './CollapsibleWidget';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';
import { getEffectiveCity, citiesMatch } from '@/lib/locationMatch';

const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning', 'late-morning', 'early-afternoon',
  'late-afternoon', 'evening', 'late-night',
];

// DB columns use underscores, app uses hyphens
const SLOT_TO_DB_COL: Record<TimeSlot, string> = {
  'early-morning': 'early_morning',
  'late-morning': 'late_morning',
  'early-afternoon': 'early_afternoon',
  'late-afternoon': 'late_afternoon',
  'evening': 'evening',
  'late-night': 'late_night',
};

interface FriendAvailDay {
  date: string;
  slots: Record<TimeSlot, boolean>;
}

export function AvailableFriends() {
  const { friends, availability, homeAddress } = usePlannerStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  const connectedFriends = useMemo(() => {
    return friends.filter(f => f.status === 'connected');
  }, [friends]);

  // Track which friends are actually available today via useQuery
  const friendUserIds = useMemo(() => {
    return connectedFriends.map(f => f.friendUserId).filter((id): id is string => !!id);
  }, [connectedFriends]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Get the current user's location for today
  const myTodayAvail = useMemo(() => {
    const todayAvail = availability.find(a => format(a.date, 'yyyy-MM-dd') === todayStr);
    return {
      locationStatus: todayAvail?.locationStatus || 'home',
      tripLocation: todayAvail?.tripLocation || null,
    };
  }, [availability, todayStr]);

  const myEffectiveCity = useMemo(() => {
    return getEffectiveCity(myTodayAvail.locationStatus, myTodayAvail.tripLocation, homeAddress);
  }, [myTodayAvail, homeAddress]);

  const { data: todayAvailableFriendIds = new Set<string>(), isLoading: loadingTodayAvail } = useQuery({
    queryKey: ['available-friends-today', friendUserIds, todayStr, myEffectiveCity],
    queryFn: async () => {
      if (friendUserIds.length === 0) return new Set<string>();

      const [availResult, plansResult, profilesResult] = await Promise.all([
        supabase
          .from('availability')
          .select('user_id, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night, location_status, trip_location')
          .in('user_id', friendUserIds)
          .eq('date', todayStr),
        supabase
          .from('plans')
          .select('user_id, time_slot')
          .in('user_id', friendUserIds)
          .gte('date', `${todayStr}T00:00:00`)
          .lte('date', `${todayStr}T23:59:59`),
        supabase
          .from('profiles')
          .select('user_id, home_address')
          .in('user_id', friendUserIds),
      ]);

      if (availResult.error) {
        console.error('Error fetching friend availability:', availResult.error);
        return new Set<string>(friendUserIds);
      }

      // Build home_address map for friends
      const friendHomeMap = new Map<string, string | null>();
      for (const p of (profilesResult.data || [])) {
        friendHomeMap.set(p.user_id, p.home_address);
      }

      const friendBusySlots = new Map<string, Set<string>>();
      for (const plan of (plansResult.data || [])) {
        if (!friendBusySlots.has(plan.user_id)) {
          friendBusySlots.set(plan.user_id, new Set());
        }
        friendBusySlots.get(plan.user_id)!.add(plan.time_slot.replace('_', '-'));
      }

      const availableIds = new Set<string>();
      for (const friendUserId of friendUserIds) {
        const row = availResult.data?.find(r => r.user_id === friendUserId);
        const busySlots = friendBusySlots.get(friendUserId) || new Set();

        // Check location: friend must be in the same city
        const friendLocStatus = row?.location_status || 'home';
        const friendTripLoc = row?.trip_location || null;
        const friendHome = friendHomeMap.get(friendUserId) || null;
        const friendCity = getEffectiveCity(friendLocStatus, friendTripLoc, friendHome);

        // Only show friends we can confirm are in the same city as the user today.
        // If we can't resolve either side's city, skip them rather than assume available.
        if (!myEffectiveCity || !friendCity || !citiesMatch(myEffectiveCity, friendCity)) {
          continue;
        }

        const hasAnyFree = TIME_SLOT_ORDER.some(slot => {
          if (busySlots.has(slot)) return false;
          if (!row) return true;
          const col = SLOT_TO_DB_COL[slot];
          return (row as any)[col] !== false;
        });
        if (hasAnyFree) availableIds.add(friendUserId);
      }

      return availableIds;
    },
    enabled: friendUserIds.length > 0,
  });

  const availableFriends = useMemo(() => {
    return connectedFriends
      .filter(f => f.friendUserId && todayAvailableFriendIds.has(f.friendUserId))
      .slice(0, 4);
  }, [connectedFriends, todayAvailableFriendIds]);



  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-primary/20 text-primary',
      'bg-activity-drinks/20 text-activity-drinks',
      'bg-activity-sports/20 text-activity-sports',
      'bg-activity-music/20 text-activity-music',
      'bg-activity-nature/20 text-activity-nature',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Removed hang request logic - now using QuickPlanSheet

  const viewAllLink = (
    <Link to="/friends" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
        View All
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );

  if (connectedFriends.length === 0) {
    return (
      <CollapsibleWidget
        title="Available Today"
        icon={<Users className="h-4 w-4 text-primary" />}
        headerRight={viewAllLink}
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 rounded-full bg-muted p-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Parade's better with friends — bring a few along</p>
          <Link to="/friends" className="mt-2">
            <Button size="sm" variant="outline">
              Invite a friend
            </Button>
          </Link>
        </div>
      </CollapsibleWidget>
    );
  }

  return (
    <>
    <CollapsibleWidget
      title="Available Today"
      icon={<Users className="h-4 w-4 text-availability-available" />}
      badge={
        !loadingTodayAvail && availableFriends.length > 0 ? (
          <span className="rounded-full bg-availability-available/10 px-2 py-0.5 text-xs font-medium text-availability-available">
            {availableFriends.length}
          </span>
        ) : undefined
      }
      headerRight={viewAllLink}
    >
      {loadingTodayAvail ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : availableFriends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 rounded-full bg-muted p-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Quiet day — nobody's free yet</p>
          <Link to="/friends" className="mt-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs">
              See your crew
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableFriends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all hover:border-primary/20 hover:shadow-soft text-left w-full"
              >
                <div
                  onClick={(e) => {
                    if (friend.friendUserId) {
                      e.stopPropagation();
                      navigate(`/friend/${friend.friendUserId}`);
                    }
                  }}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold",
                    getAvatarColor(friend.name)
                  )}
                >
                  {friend.avatar ? (
                    <img
                      src={friend.avatar}
                      alt={friend.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(friend.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{friend.name}</p>
                  <p className="text-xs text-availability-available">Free today</p>
                </div>
              </button>
            ))}
          </div>

          {connectedFriends.filter(f => f.friendUserId && todayAvailableFriendIds.has(f.friendUserId)).length > 4 && (
            <Link to="/friends" className="mt-3 block">
              <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                See {connectedFriends.filter(f => f.friendUserId && todayAvailableFriendIds.has(f.friendUserId)).length - 4} more available
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </>
      )}
    </CollapsibleWidget>

      <QuickPlanSheet
        open={!!selectedFriend}
        onOpenChange={(open) => { if (!open) setSelectedFriend(null); }}
        preSelectedFriend={selectedFriend?.friendUserId ? {
          userId: selectedFriend.friendUserId,
          name: selectedFriend.name,
          avatar: selectedFriend.avatar,
        } : undefined}
      />
    </>
  );
}
