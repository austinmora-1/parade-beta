import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { CalendarPlus, Sparkles, Send, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Friend, VIBE_CONFIG, VibeType, TimeSlot, TIME_SLOT_LABELS } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { resolveEffectiveCity, isFriendInMyCity } from '@/lib/effectiveCity';
import { formatCityForDisplay } from '@/lib/formatCity';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Map app TimeSlot -> preferred_social_times bucket id used in profile prefs
const SLOT_TO_PREF_BUCKET: Record<TimeSlot, string> = {
  'early-morning': 'morning',
  'late-morning': 'morning',
  'early-afternoon': 'afternoon',
  'late-afternoon': 'afternoon',
  'evening': 'evening',
  'late-night': 'late-night',
};

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
  overlapSlots: OverlapSlot[]; // mutual free slots in same city — falls back to friend-only free slots when no mutual overlap
  city: string | null;
  currentVibe: string | null;
  customVibeTags: string[] | null;
  mutual: boolean; // true if overlapSlots are mutual; false if they're friend-only fallback
}

interface FriendVibeStripProps {
  // kept for backward compatibility with Dashboard prop, no longer used
  onFriendTap?: (friend: { userId: string; name: string; avatar?: string }) => void;
}

export function FriendVibeStrip(_props: FriendVibeStripProps = {}) {
  const { friends, availability, homeAddress } = usePlannerStore();
  const { user } = useAuth();
  const [around, setAround] = useState<AroundFriend[]>([]);
  const [preferredTimes, setPreferredTimes] = useState<Set<string>>(new Set());

  const connectedFriends = useMemo(
    () => friends.filter(f => f.status === 'connected' && f.friendUserId),
    [friends]
  );

  // Load my preferred social times (e.g. "monday:evening")
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('preferred_social_times')
        .eq('user_id', user.id)
        .single();
      if (cancelled) return;
      const times = (data as { preferred_social_times: string[] | null } | null)?.preferred_social_times;
      setPreferredTimes(new Set(times || []));
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

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
        const friendOnlySlots: OverlapSlot[] = [];
        const dayHasOverlap = new Set<string>();
        const dayHasFriendFree = new Set<string>();
        let cityOnAvailableDay: string | null = null;
        let cityOnFriendFreeDay: string | null = null;

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
          let dayHadAnyFriendFree = false;
          for (const { col, slot } of SLOT_KEYS) {
            const friendFree = !!(avail as any)[col];
            const meFree = mySlots ? mySlots[slot] : true;
            if (friendFree) {
              friendOnlySlots.push({ date, slot });
              dayHadAnyFriendFree = true;
            }
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
          if (dayHadAnyFriendFree) {
            dayHasFriendFree.add(date);
            if (!cityOnFriendFreeDay) {
              const friendCity = (avail as any).location_status === 'away' && (avail as any).trip_location
                ? (avail as any).trip_location
                : ((profile as any)?.home_address ?? myCity);
              cityOnFriendFreeDay = friendCity;
            }
          }
        }

        // Prefer mutual overlap; fall back to friend's own free slots so the
        // friend still surfaces in "Who's around this week" even when our
        // calendars don't currently align.
        if (overlapSlots.length > 0) {
          return [{
            friend,
            freeDays: dayHasOverlap.size,
            overlapSlots,
            city: cityOnAvailableDay,
            currentVibe: (profile as any)?.current_vibe ?? null,
            customVibeTags: (profile as any)?.custom_vibe_tags ?? null,
            mutual: true,
          }];
        }
        if (friendOnlySlots.length > 0) {
          return [{
            friend,
            freeDays: dayHasFriendFree.size,
            overlapSlots: friendOnlySlots,
            city: cityOnFriendFreeDay,
            currentVibe: (profile as any)?.current_vibe ?? null,
            customVibeTags: (profile as any)?.custom_vibe_tags ?? null,
            mutual: false,
          }];
        }
        return [];
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
            preferredTimes={preferredTimes}
          />
        ))}
      </div>
    </div>
  );
}

function FriendPill({
  data,
  index,
  preferredTimes,
}: {
  data: AroundFriend;
  index: number;
  preferredTimes: Set<string>;
}) {
  const { friend, freeDays, overlapSlots, city, currentVibe, customVibeTags } = data;
  const { user } = useAuth();
  const vibeConfig = currentVibe ? VIBE_CONFIG[currentVibe as VibeType] : null;
  const isCustom = currentVibe === 'custom';
  const vibeLabel = isCustom && customVibeTags?.length
    ? `#${customVibeTags[0]}`
    : vibeConfig?.label ?? null;
  const cityLabel = city ? (formatCityForDisplay(city) || city.split(',')[0]) : null;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Reset selection when popover closes
  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  const slotKey = (s: OverlapSlot) => `${s.date}|${s.slot}`;

  const isRecommended = (s: OverlapSlot) => {
    const day = format(parseISO(s.date), 'EEEE').toLowerCase();
    const bucket = SLOT_TO_PREF_BUCKET[s.slot];
    return preferredTimes.has(`${day}:${bucket}`);
  };

  const toggleSlot = (s: OverlapSlot) => {
    const k = slotKey(s);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const sendHangRequest = async () => {
    if (!user || !friend.friendUserId || selected.size === 0) return;
    setSending(true);
    try {
      const [{ data: friendProfile }, { data: myProfile }] = await Promise.all([
        supabase
          .from('friend_profiles')
          .select('share_code')
          .eq('user_id', friend.friendUserId)
          .single(),
        supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single(),
      ]);

      if (!(friendProfile as any)?.share_code) {
        toast.error("Could not find friend's profile");
        setSending(false);
        return;
      }

      const requesterName = (myProfile as any)?.display_name || user.email || 'Someone';
      const slotsToSend = overlapSlots.filter(s => selected.has(slotKey(s)));

      // Send each selected slot as a hang request
      const results = await Promise.all(
        slotsToSend.map(s => {
          const dt = parseISO(s.date);
          const dayLabel = isSameDay(dt, new Date())
            ? 'Today'
            : isSameDay(dt, addDays(new Date(), 1))
              ? 'Tomorrow'
              : format(dt, 'EEE, MMM d');
          return supabase.functions.invoke('send-hang-request', {
            body: {
              shareCode: (friendProfile as any).share_code,
              requesterName,
              requesterEmail: user.email,
              requesterUserId: user.id,
              selectedDay: s.date,
              selectedDayLabel: dayLabel,
              selectedSlot: s.slot,
              selectedSlotLabel: TIME_SLOT_LABELS[s.slot]?.label || s.slot,
            },
          });
        })
      );

      const failed = results.filter(r => r.error);
      if (failed.length > 0) throw failed[0].error;

      toast.success(
        slotsToSend.length === 1
          ? `Asked ${friend.name.split(' ')[0]} to hang!`
          : `Sent ${slotsToSend.length} options to ${friend.name.split(' ')[0]}!`
      );
      setOpen(false);
    } catch (err: any) {
      console.error('Error sending hang request:', err);
      toast.error(err?.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const selectionCount = selected.size;
  const buttonLabel = selectionCount <= 1
    ? `Ask ${friend.name.split(' ')[0]} to hang`
    : `Send ${selectionCount} options to ${friend.name.split(' ')[0]}`;

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
            {selectionCount === 0
              ? 'Tap one or more times to propose'
              : `${selectionCount} selected — add more or send`}
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
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
            const k = slotKey(s);
            const isSelected = selected.has(k);
            const recommended = isRecommended(s);
            return (
              <button
                key={`${s.date}-${s.slot}-${idx}`}
                onClick={() => toggleSlot(s)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors border',
                  isSelected
                    ? 'bg-primary/10 border-primary/50'
                    : 'bg-transparent border-transparent hover:bg-primary/5 hover:border-primary/30'
                )}
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      'text-xs font-semibold truncate',
                      today ? 'text-primary' : 'text-foreground'
                    )}>
                      {dayLabel}
                    </span>
                    {recommended && (
                      <span
                        title="Matches your preferred social time"
                        className="inline-flex items-center gap-0.5 rounded-full bg-secondary/15 text-secondary px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        Pick
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {slotMeta.label} · {slotMeta.time}
                  </span>
                </div>
                {isSelected ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                    <Check className="h-3 w-3" />
                  </span>
                ) : (
                  <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-border p-2">
          <Button
            size="sm"
            className="w-full gap-1.5"
            disabled={selectionCount === 0 || sending}
            onClick={sendHangRequest}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span className="truncate">{buttonLabel}</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
