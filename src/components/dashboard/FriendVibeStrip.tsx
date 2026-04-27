import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Friend, VIBE_CONFIG, VibeType, TimeSlot, TIME_SLOT_LABELS } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { resolveEffectiveCity, isFriendInMyCity } from '@/lib/effectiveCity';
import { formatCityForDisplay } from '@/lib/formatCity';

const QuickPlanSheet = lazy(() =>
  import('@/components/plans/QuickPlanSheet').then(m => ({ default: m.QuickPlanSheet }))
);

const SLOT_KEYS: { col: string; slot: TimeSlot }[] = [
  { col: 'early_morning',   slot: 'early-morning'   },
  { col: 'late_morning',    slot: 'late-morning'    },
  { col: 'early_afternoon', slot: 'early-afternoon' },
  { col: 'late_afternoon',  slot: 'late-afternoon'  },
  { col: 'evening',         slot: 'evening'         },
  { col: 'late_night',      slot: 'late-night'      },
];

interface OverlapSlot {
  date: string;     // yyyy-MM-dd
  slot: TimeSlot;
}

interface AroundFriend {
  friend: Friend;
  freeDays: number;
  overlapSlots: OverlapSlot[]; // mutual free slots in same city
  city: string | null;
  currentVibe: string | null;
  customVibeTags: string[] | null;
}

interface FriendVibeStripProps {
  // kept for backward compatibility with Dashboard prop, no longer used
  onFriendTap?: (friend: { userId: string; name: string; avatar?: string }) => void;
}

export function FriendVibeStrip(_props: FriendVibeStripProps = {}) {
  const { friends, availability, homeAddress } = usePlannerStore();
  const [around, setAround] = useState<AroundFriend[]>([]);
  const [planContext, setPlanContext] = useState<{
    friend: { userId: string; name: string; avatar?: string };
    date: Date;
    slot: TimeSlot;
  } | null>(null);

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

  // Map of my own slot availability per date for overlap calculation
  const mySlotsByDate = useMemo(() => {
    const map: Record<string, Record<TimeSlot, boolean>> = {};
    for (const a of availability) {
      const key = format(a.date, 'yyyy-MM-dd');
      if (!weekDates.includes(key)) continue;
      map[key] = a.slots;
    }
    return map;
  }, [availability, weekDates]);

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
          .select('user_id, home_address, current_vibe, custom_vibe_tags')
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
        const overlapSlots: OverlapSlot[] = [];
        const dayHasOverlap = new Set<string>();
        let cityOnAvailableDay: string | null = null;

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

          const mySlots = mySlotsByDate[date];
          let dayHadAnyMutual = false;
          for (const { col, slot } of SLOT_KEYS) {
            const friendFree = !!(avail as any)[col];
            // If user has no row for this date, default-free behavior comes from
            // mapAvailability defaults (true) — treat missing as free.
            const meFree = mySlots ? mySlots[slot] : true;
            if (friendFree && meFree) {
              overlapSlots.push({ date, slot });
              dayHadAnyMutual = true;
            }
          }

          if (dayHadAnyMutual) {
            dayHasOverlap.add(date);
            if (!cityOnAvailableDay) {
              const friendCity = (avail as any).location_status === 'away' && (avail as any).trip_location
                ? (avail as any).trip_location
                : ((profile as any)?.home_address ?? myCity);
              cityOnAvailableDay = friendCity;
            }
          }
        }

        if (overlapSlots.length === 0) return [];
        return [{
          friend,
          freeDays: dayHasOverlap.size,
          overlapSlots,
          city: cityOnAvailableDay,
          currentVibe: (profile as any)?.current_vibe ?? null,
          customVibeTags: (profile as any)?.custom_vibe_tags ?? null,
        }];
      });

      result.sort((a, b) => b.freeDays - a.freeDays || a.friend.name.localeCompare(b.friend.name));

      if (!cancelled) setAround(result);
    })();

    return () => { cancelled = true; };
  }, [connectedFriends, weekDates, myCityByDate, mySlotsByDate]);

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
        <p className="text-[11px] font-semibold uppercase tracking-wider px-1 text-primary">
          Who's around this week
        </p>
        <div className="flex flex-wrap gap-2 px-1">
          {around.map((a, i) => (
            <FriendPill
              key={a.friend.id}
              data={a}
              index={i}
              onPickSlot={(slot) => {
                if (!a.friend.friendUserId) return;
                setPlanContext({
                  friend: {
                    userId: a.friend.friendUserId,
                    name: a.friend.name,
                    avatar: a.friend.avatar,
                  },
                  date: parseISO(slot.date),
                  slot: slot.slot,
                });
              }}
            />
          ))}
        </div>
      </div>

      {planContext && (
        <Suspense fallback={null}>
          <QuickPlanSheet
            open={!!planContext}
            onOpenChange={(v) => { if (!v) setPlanContext(null); }}
            preSelectedFriend={planContext.friend}
            preSelectedFriends={[planContext.friend]}
            preSelectedDate={planContext.date}
            preSelectedTimeSlot={planContext.slot}
          />
        </Suspense>
      )}
    </>
  );
}

function FriendPill({
  data,
  index,
  onPickSlot,
}: {
  data: AroundFriend;
  index: number;
  onPickSlot: (slot: OverlapSlot) => void;
}) {
  const { friend, freeDays, overlapSlots, city, currentVibe, customVibeTags } = data;
  const vibeConfig = currentVibe ? VIBE_CONFIG[currentVibe as VibeType] : null;
  const isCustom = currentVibe === 'custom';
  const vibeLabel = isCustom && customVibeTags?.length
    ? `#${customVibeTags[0]}`
    : vibeConfig?.label ?? null;
  const cityLabel = city ? (formatCityForDisplay(city) || city.split(',')[0]) : null;

  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03, duration: 0.2 }}
          className={cn(
            'inline-flex items-center gap-2.5 rounded-2xl border border-border bg-card pl-1.5 pr-3 py-1.5 text-left',
            'transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] shadow-soft'
          )}
        >
          <div className="relative shrink-0">
            <img
              src={friend.avatar || getElephantAvatar(friend.name)}
              alt=""
              className={cn(
                'h-9 w-9 rounded-full object-cover',
                vibeConfig && 'ring-2 ring-offset-1 ring-offset-card'
              )}
              style={vibeConfig ? { boxShadow: `0 0 0 2px hsl(var(--${vibeConfig.color}))` } : undefined}
            />
            {vibeConfig && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-card bg-background shadow-sm">
                <vibeConfig.icon className="h-2.5 w-2.5 text-foreground" />
              </span>
            )}
          </div>

          <div className="flex flex-col min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold text-foreground truncate max-w-[7.5rem]">
                {friend.name.split(' ')[0]}
              </span>
              <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 shrink-0">
                {freeDays}d
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
              {vibeLabel && (
                <span className="truncate max-w-[6rem]">{vibeLabel}</span>
              )}
              {vibeLabel && cityLabel && <span aria-hidden>·</span>}
              {cityLabel && (
                <span className="truncate max-w-[6rem]">{cityLabel}</span>
              )}
              {!vibeLabel && !cityLabel && (
                <span className="text-muted-foreground/70">free this week</span>
              )}
            </div>
          </div>
        </motion.button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-72 p-0 rounded-xl overflow-hidden"
      >
        <div className="px-3 pt-3 pb-2 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mutually free with {friend.name.split(' ')[0]}
          </p>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
            Tap a slot to start a plan
          </p>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {overlapSlots.map((s, idx) => {
            const dt = parseISO(s.date);
            const today = isSameDay(dt, new Date());
            const tomorrow = isSameDay(dt, addDays(new Date(), 1));
            const dayLabel = today
              ? 'Today'
              : tomorrow
                ? 'Tomorrow'
                : format(dt, 'EEE, MMM d');
            const slotMeta = TIME_SLOT_LABELS[s.slot];
            return (
              <button
                key={`${s.date}-${s.slot}-${idx}`}
                onClick={() => {
                  setOpen(false);
                  onPickSlot(s);
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  'hover:bg-primary/5 border border-transparent hover:border-primary/30'
                )}
              >
                <div className="flex flex-col min-w-0">
                  <span className={cn(
                    'text-xs font-semibold truncate',
                    today ? 'text-primary' : 'text-foreground'
                  )}>
                    {dayLabel}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {slotMeta.label} · {slotMeta.time}
                  </span>
                </div>
                <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
