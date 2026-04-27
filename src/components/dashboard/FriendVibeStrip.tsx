import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Friend } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { resolveEffectiveCity, isFriendInMyCity } from '@/lib/effectiveCity';

const GuidedPlanSheet = lazy(() => import('@/components/plans/GuidedPlanSheet'));

const SLOT_KEYS = [
  'early_morning', 'late_morning', 'early_afternoon',
  'late_afternoon', 'evening', 'late_night',
] as const;

interface AroundFriend {
  friend: Friend;
  freeDays: number;
}

interface FriendVibeStripProps {
  // kept for backward compatibility with Dashboard prop, no longer used
  onFriendTap?: (friend: { userId: string; name: string; avatar?: string }) => void;
}

export function FriendVibeStrip(_props: FriendVibeStripProps = {}) {
  const { friends, availability, homeAddress } = usePlannerStore();
  const [around, setAround] = useState<AroundFriend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<{ userId: string; name: string; avatar?: string } | null>(null);

  const connectedFriends = useMemo(
    () => friends.filter(f => f.status === 'connected' && f.friendUserId),
    [friends]
  );

  // 7-day window starting today
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(addDays(new Date(), i), 'yyyy-MM-dd')),
    []
  );

  // Resolve my effective city for each day in the window
  const myCityByDate = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const d of weekDates) {
      map[d] = resolveEffectiveCity({
        date: d,
        availability: availability.map((a) => ({
          date: a.date,
          location_status: a.locationStatus,
          trip_location: a.tripLocation ?? null,
        })),
        homeAddress,
      });
    }
    return map;
  }, [weekDates, availability, homeAddress]);

  useEffect(() => {
    if (connectedFriends.length === 0) {
      setAround([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const friendUserIds = connectedFriends.map(f => f.friendUserId!);

      const [{ data: profileData }, { data: availData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, home_address')
          .in('user_id', friendUserIds),
        supabase
          .from('availability')
          .select('user_id, date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night, location_status, trip_location')
          .in('user_id', friendUserIds)
          .in('date', weekDates),
      ]);

      const profileMap = new Map((profileData || []).map(p => [p.user_id, p]));
      const availByUserDate = new Map<string, any>();
      (availData || []).forEach(a => {
        availByUserDate.set(`${a.user_id}|${a.date}`, a);
      });

      const result: AroundFriend[] = connectedFriends.flatMap(friend => {
        const profile = profileMap.get(friend.friendUserId!);
        let freeDays = 0;

        for (const date of weekDates) {
          const myCity = myCityByDate[date];
          if (!myCity) continue;
          const avail = availByUserDate.get(`${friend.friendUserId}|${date}`);

          const sameCity = isFriendInMyCity({
            date,
            myAvailability: { date, location_status: 'away', trip_location: myCity },
            myHomeAddress: myCity,
            friendAvailability: avail
              ? { date, location_status: (avail as any).location_status, trip_location: (avail as any).trip_location }
              : null,
            friendHomeAddress: (profile as any)?.home_address ?? null,
          });
          if (!sameCity || !avail) continue;

          const hasAnySlot = SLOT_KEYS.some(k => (avail as any)[k]);
          if (hasAnySlot) freeDays += 1;
        }

        if (freeDays === 0) return [];
        return [{ friend, freeDays }];
      });

      result.sort((a, b) => b.freeDays - a.freeDays || a.friend.name.localeCompare(b.friend.name));

      if (!cancelled) setAround(result);
    })();

    return () => { cancelled = true; };
  }, [connectedFriends, weekDates, myCityByDate]);

  if (connectedFriends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-5 text-center">
        <span className="text-2xl">👋</span>
        <p className="text-xs text-muted-foreground">Add friends to see their vibes</p>
      </div>
    );
  }

  if (around.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Who's around this week
        </p>
        <div className="flex flex-wrap gap-1.5 px-1">
          {around.map((a, i) => (
            <FriendPill
              key={a.friend.id}
              data={a}
              index={i}
              onClick={() => {
                if (!a.friend.friendUserId) return;
                setSelectedFriend({
                  userId: a.friend.friendUserId,
                  name: a.friend.name,
                  avatar: a.friend.avatar,
                });
              }}
            />
          ))}
        </div>
      </div>

      {selectedFriend && (
        <Suspense fallback={null}>
          <GuidedPlanSheet
            open={!!selectedFriend}
            onOpenChange={(v) => { if (!v) setSelectedFriend(null); }}
            preSelectedFriends={[selectedFriend]}
          />
        </Suspense>
      )}
    </>
  );
}

function FriendPill({ data, index, onClick }: { data: AroundFriend; index: number; onClick: () => void }) {
  const { friend, freeDays } = data;
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-card pl-1 pr-2.5 py-1 text-xs',
        'transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.97]'
      )}
    >
      <img
        src={friend.avatar || getElephantAvatar(friend.name)}
        alt=""
        className="h-5 w-5 rounded-full object-cover"
      />
      <span className="font-medium text-foreground truncate max-w-[7rem]">
        {friend.name.split(' ')[0]}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {freeDays}d
      </span>
    </motion.button>
  );
}
