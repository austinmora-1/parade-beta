import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarPlus, Loader2, ArrowLeft, Sparkles, CalendarDays, Check, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePlannerStore } from '@/stores/plannerStore';
import { ACTIVITY_CONFIG, TimeSlot, ActivityType } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { getEffectiveCity, citiesMatch } from '@/lib/locationMatch';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { SlotCalendarPicker } from '@/components/plans/SlotCalendarPicker';
import { useVisualViewport } from '@/hooks/useVisualViewport';

interface GuidedPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedFriends: { userId: string; name: string; avatar?: string }[];
}

type Step = 'activity' | 'time' | 'confirm';

const SUGGESTED_ACTIVITIES: { id: ActivityType; emoji: string; label: string }[] = [
  { id: 'drinks', emoji: '🍹', label: 'Drinks' },
  { id: 'dinner', emoji: '🍽️', label: 'Dinner' },
  { id: 'hanging-out', emoji: '🤙', label: 'Hangout' },
  { id: 'concert', emoji: '🎵', label: 'Concert' },
  { id: 'movies', emoji: '🎥', label: 'Movies' },
  { id: 'gym', emoji: '🏋️', label: 'Gym' },
  { id: 'park', emoji: '🌳', label: 'Park' },
  { id: 'hiking', emoji: '🥾', label: 'Hiking' },
  { id: 'yoga', emoji: '🧘', label: 'Yoga' },
  { id: 'grilling', emoji: '🔥', label: 'Grilling' },
];

interface BestSlot {
  date: Date;
  slot: TimeSlot;
  status: 'all-free' | 'some-free';
  freeCount: number;
  total: number;
  sharedCity: string;
}

const SLOT_LABELS: Record<string, string> = {
  'late-morning': 'Morning',
  'early-afternoon': 'Lunch',
  'late-afternoon': 'Afternoon',
  'evening': 'Evening',
  'late-night': 'Late Night',
};


function SlotCard({ bs, i, onSelect }: { bs: BestSlot; i: number; onSelect: (bs: BestSlot) => void }) {
  const dayLabel = isSameDay(bs.date, new Date())
    ? 'Today'
    : isSameDay(bs.date, addDays(new Date(), 1))
      ? 'Tomorrow'
      : format(bs.date, 'EEEE, MMM d');

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.08 }}
      onClick={() => onSelect(bs)}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
        bs.status === 'all-free'
          ? "border-availability-available/40 bg-availability-available/5 hover:bg-availability-available/10"
          : "border-border hover:border-primary/30 hover:bg-primary/5"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{dayLabel}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{SLOT_LABELS[bs.slot]}</p>
          {bs.sharedCity && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/80">
              <MapPin className="h-2.5 w-2.5" />
              {bs.sharedCity}
            </span>
          )}
        </div>
      </div>
      {bs.status === 'all-free' && bs.total > 0 ? (
        <span className="text-[10px] font-medium text-availability-available bg-availability-available/10 rounded-full px-2 py-0.5 shrink-0">
          Everyone's free ✓
        </span>
      ) : bs.total > 0 ? (
        <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
          {bs.freeCount}/{bs.total} free
        </span>
      ) : null}
    </motion.button>
  );
}

export function GuidedPlanSheet({ open, onOpenChange, preSelectedFriends }: GuidedPlanSheetProps) {
  const { proposePlan, friends, userId, availabilityMap: myAvailabilityMap, plans: myPlans, homeAddress } = usePlannerStore();
  const viewport = useVisualViewport();

  const [step, setStep] = useState<Step>('activity');
  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null);
  const [sending, setSending] = useState(false);
  const [bestSlots, setBestSlots] = useState<BestSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [friendMultiDayAvail, setFriendMultiDayAvail] = useState<Record<string, Record<TimeSlot, { free: number; total: number }>>>({});
  const [selectedSharedCity, setSelectedSharedCity] = useState<string>('');

  const friendNames = preSelectedFriends.map(f => f.name.split(' ')[0]);
  const friendNamesStr = friendNames.length <= 2 ? friendNames.join(' & ') : `${friendNames.slice(0, -1).join(', ')} & ${friendNames[friendNames.length - 1]}`;

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('activity');
      setActivity(null);
      setSelectedDate(null);
      setTimeSlot(null);
      setSending(false);
      setBestSlots([]);
      setShowCalendar(false);
      setFriendMultiDayAvail({});
    }
  }, [open]);

  // Fetch availability + best slots when moving to time step
  const fetchBestSlots = useCallback(async () => {
    if (preSelectedFriends.length === 0) return;
    setLoadingSlots(true);

    const userIds = preSelectedFriends.map(f => f.userId);
    const scanDays = Array.from({ length: 180 }, (_, i) => addDays(new Date(), i));
    const startDate = format(scanDays[0], 'yyyy-MM-dd');
    const endDate = format(scanDays[179], 'yyyy-MM-dd');

    const allUserIds = userId ? [...userIds, userId] : userIds;
    const [{ data: availData }, { data: plansData }, { data: friendProfiles }, { data: tripsData }] = await Promise.all([
      supabase.from('availability').select('*').in('user_id', allUserIds).gte('date', startDate).lte('date', endDate),
      supabase.from('plans').select('time_slot, user_id, date, status').in('user_id', allUserIds).gte('date', startDate).lte('date', endDate).in('status', ['confirmed', 'proposed']),
      supabase.from('profiles').select('user_id, home_address').in('user_id', userIds),
      supabase.from('trips').select('user_id, location, start_date, end_date').in('user_id', allUserIds).gte('end_date', startDate).lte('start_date', endDate),
    ]);

    // Build friend home address map
    const friendHomeMap = new Map<string, string | null>();
    for (const p of (friendProfiles || [])) {
      friendHomeMap.set(p.user_id, p.home_address);
    }

    // Build trip lookup: for a given userId + date, find the trip location
    const tripsByUser = new Map<string, { location: string; start_date: string; end_date: string }[]>();
    for (const t of (tripsData || [])) {
      if (!tripsByUser.has(t.user_id)) tripsByUser.set(t.user_id, []);
      tripsByUser.get(t.user_id)!.push(t);
    }
    function getTripLocationForDate(uid: string, dateStr: string): string | null {
      const trips = tripsByUser.get(uid);
      if (!trips) return null;
      for (const t of trips) {
        if (dateStr >= t.start_date && dateStr <= t.end_date) return t.location;
      }
      return null;
    }

    const allSlots: TimeSlot[] = ['late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];
    const results: BestSlot[] = [];
    const multiDay: typeof friendMultiDayAvail = {};

    // Index availability and plans by "userId:date" for O(1) lookup
    const availIndex = new Map<string, (typeof availData extends (infer T)[] | null ? T : never)>();
    for (const a of (availData || [])) {
      availIndex.set(`${a.user_id}:${a.date}`, a);
    }
    const planIndex = new Map<string, Set<string>>();
    for (const p of (plansData || [])) {
      const key = `${p.user_id}:${p.date?.slice(0, 10)}`;
      if (!planIndex.has(key)) planIndex.set(key, new Set());
      planIndex.get(key)!.add(p.time_slot);
    }

    for (const day of scanDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const slotMap = {} as Record<TimeSlot, { free: number; total: number }>;

      // Get my availability — prefer store data, fall back to fetched data for dates beyond store range
      let myDay = myAvailabilityMap[dateStr];
      if (!myDay && userId) {
        const myRow = availIndex.get(`${userId}:${dateStr}`);
        if (myRow) {
          myDay = {
            date: day,
            slots: {
              'early-morning': myRow.early_morning ?? true,
              'late-morning': myRow.late_morning ?? true,
              'early-afternoon': myRow.early_afternoon ?? true,
              'late-afternoon': myRow.late_afternoon ?? true,
              'evening': myRow.evening ?? true,
              'late-night': myRow.late_night ?? true,
            },
            locationStatus: (myRow.location_status as any) || 'home',
            tripLocation: myRow.trip_location || undefined,
          };
        }
      }

      // Get my effective city — also check trips as fallback
      const myLocStatus = myDay?.locationStatus || 'home';
      let myTripLoc = myDay?.tripLocation || null;
      if (!myTripLoc && userId) {
        const tripLoc = getTripLocationForDate(userId, dateStr);
        if (tripLoc) myTripLoc = tripLoc;
      }
      const myEffectiveStatus = myTripLoc ? 'away' : myLocStatus;
      const myCity = getEffectiveCity(myEffectiveStatus, myTripLoc, homeAddress);

      // Debug: log location resolution for first 7 days
      if (scanDays.indexOf(day) < 14 || myCity !== getEffectiveCity('home', null, homeAddress)) {
        console.log(`[PlanWizard] ${dateStr} MY: status=${myEffectiveStatus} tripLoc=${myTripLoc} home=${homeAddress} → city=${myCity}`, myDay ? { locStatus: myDay.locationStatus, tripLoc: myDay.tripLocation } : 'no avail record');
      }

      // Check if I have plans on this date
      const myPlanSlots = userId ? planIndex.get(`${userId}:${dateStr}`) : undefined;

      for (const slot of allSlots) {
        const myFree = myDay ? myDay.slots[slot] : true;
        const myBusy = myPlanSlots?.has(slot) || false;
        const iAmFree = myFree && !myBusy;

        let freeCount = 0;
        for (const uid of userIds) {
          const row = availIndex.get(`${uid}:${dateStr}`);
          const colName = slot.replace(/-/g, '_') as string;
          const isAvailable = row ? ((row as any)[colName] ?? true) : true;
          const hasPlan = planIndex.get(`${uid}:${dateStr}`)?.has(slot) || false;

          // Check co-location using availability, then trips as fallback
          let friendLocStatus = row?.location_status || 'home';
          let friendTripLoc = row?.trip_location || null;
          const friendHome = friendHomeMap.get(uid) || null;

          // If no availability record or no trip_location, check trips table
          if (!friendTripLoc) {
            const tripLoc = getTripLocationForDate(uid, dateStr);
            if (tripLoc) {
              friendLocStatus = 'away';
              friendTripLoc = tripLoc;
            }
          }

          const friendCity = getEffectiveCity(friendLocStatus, friendTripLoc, friendHome);
          // Both cities must be known to confirm co-location
          const coLocated = myCity && friendCity ? citiesMatch(myCity, friendCity) : false;

          if (isAvailable && !hasPlan && coLocated) freeCount++;
        }
        slotMap[slot] = { free: freeCount, total: userIds.length };

        if (iAmFree && freeCount > 0) {
          // Capitalize the shared city name
          const rawCity = myCity || '';
          const sharedCity = rawCity ? rawCity.charAt(0).toUpperCase() + rawCity.slice(1) : '';
          results.push({
            date: day,
            slot,
            status: freeCount === userIds.length ? 'all-free' : 'some-free',
            freeCount,
            total: userIds.length,
            sharedCity,
          });
        }
      }
      multiDay[dateStr] = slotMap;
    }

    setFriendMultiDayAvail(multiDay);

    // Sort: all-free first, then by date, then by slot priority
    const slotOrder: Record<string, number> = { 'late-morning': 0, 'early-afternoon': 1, 'late-afternoon': 2, 'evening': 3, 'late-night': 4 };
    results.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'all-free' ? -1 : 1;
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return (slotOrder[a.slot] || 0) - (slotOrder[b.slot] || 0);
    });

    // Group by city, take up to 3 per city, flatten
    const cityGroups = new Map<string, BestSlot[]>();
    for (const r of results) {
      const key = r.sharedCity || 'Unknown';
      if (!cityGroups.has(key)) cityGroups.set(key, []);
      const group = cityGroups.get(key)!;
      if (group.length < 3) group.push(r);
    }
    const grouped = Array.from(cityGroups.values()).flat();
    setBestSlots(grouped);
    setLoadingSlots(false);
  }, [preSelectedFriends, myAvailabilityMap, myPlans, homeAddress, userId]);

  // When step changes to 'time', fetch best slots (covers full 180-day window)
  useEffect(() => {
    if (step === 'time') {
      fetchBestSlots();
    }
  }, [step]);

  const getSlotStatusForDate = useCallback((date: Date, slot: TimeSlot): 'all-free' | 'some-free' | 'none-free' | null => {
    if (preSelectedFriends.length === 0) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvail = friendMultiDayAvail[dateStr];
    if (!dayAvail) return null;
    const avail = dayAvail[slot];
    if (!avail) return null;

    const myDay = myAvailabilityMap[dateStr];
    const myFree = myDay ? myDay.slots[slot] : true;
    const myBusy = myPlans.some(p => isSameDay(p.date, date) && p.timeSlot === slot);
    const iAmFree = myFree && !myBusy;

    if (iAmFree && avail.free === avail.total) return 'all-free';
    if (iAmFree && avail.free > 0) return 'some-free';
    if (!iAmFree || avail.free === 0) return 'none-free';
    return null;
  }, [friendMultiDayAvail, preSelectedFriends, myAvailabilityMap, myPlans]);

  const handleSelectActivity = (act: ActivityType) => {
    setActivity(act);
    setStep('time');
  };

  const handleSelectSlot = (bs: BestSlot) => {
    setSelectedDate(bs.date);
    setTimeSlot(bs.slot);
    setSelectedSharedCity(bs.sharedCity);
    setStep('confirm');
  };

  const handleCalendarSelect = (date: Date, slot: TimeSlot) => {
    setSelectedDate(date);
    setTimeSlot(slot);
    setShowCalendar(false);
    setStep('confirm');
  };

  const activityLabel = activity ? (SUGGESTED_ACTIVITIES.find(a => a.id === activity)?.label || ACTIVITY_CONFIG[activity]?.label || activity) : '';
  const activityEmoji = activity ? (SUGGESTED_ACTIVITIES.find(a => a.id === activity)?.emoji || '📅') : '';

  const autoTitle = activity
    ? `${activityLabel} with ${friendNames.join(', ')}`
    : `Hang with ${friendNames.join(', ')}`;

  const handleSubmit = async () => {
    if (!activity || !selectedDate || !timeSlot) return;
    setSending(true);

    try {
      const firstFriend = preSelectedFriends[0];
      await proposePlan({
        recipientFriendId: firstFriend.userId,
        activity: activity,
        date: selectedDate,
        timeSlot: timeSlot,
        title: autoTitle,
      });

      if (preSelectedFriends.length > 1) {
        const { data: latestPlan } = await supabase
          .from('plans')
          .select('id')
          .eq('user_id', userId || '')
          .eq('status', 'proposed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestPlan) {
          const additionalParticipants = preSelectedFriends.slice(1).map(f => ({
            plan_id: latestPlan.id,
            friend_id: f.userId,
            status: 'invited',
            role: 'participant',
          }));
          await supabase.from('plan_participants').insert(additionalParticipants);
        }
      }

      confetti({
        particleCount: 80,
        spread: 55,
        origin: { y: 0.75 },
        colors: ['#3D8C6C', '#FF6B6B', '#F59E0B', '#8B5CF6', '#3B82F6'],
        scalar: 0.9,
      });
      toast.success(`Plan sent to ${friendNamesStr}! 🎉`);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create plan:', err);
      toast.error('Something went wrong. Try again?');
    } finally {
      setSending(false);
    }
  };

  const stepTitle = step === 'activity'
    ? `What do you want to do with ${friendNamesStr}?`
    : step === 'time'
      ? `When works for ${activityLabel.toLowerCase()}?`
      : 'Look good?';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[90vh]"
        style={viewport ? { maxHeight: `${Math.min(viewport.height * 0.9, window.innerHeight * 0.9)}px` } : undefined}
      >
        <DrawerHeader className="pb-2 relative">
          {step !== 'activity' && (
            <button
              onClick={() => {
                if (step === 'confirm') { setStep('time'); setShowCalendar(false); }
                else if (step === 'time') setStep('activity');
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <DrawerTitle className="text-center text-sm font-semibold px-8">
            {stepTitle}
          </DrawerTitle>
        </DrawerHeader>

        {/* Friend avatars strip */}
        <div className="flex items-center justify-center gap-1 px-4 pb-3">
          <div className="flex -space-x-2">
            {preSelectedFriends.slice(0, 5).map(f => (
              <Avatar key={f.userId} className="h-7 w-7 border-2 border-background">
                <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                <AvatarFallback className="text-[9px]">{f.name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-2">{friendNamesStr}</span>
        </div>

        <div className="px-4 pb-2 overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {/* STEP 1: Activity selection */}
            {step === 'activity' && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <p className="text-xs text-muted-foreground text-center">
                  Pick an activity or let Parade suggest one
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTED_ACTIVITIES.map((a) => (
                    <motion.button
                      key={a.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSelectActivity(a.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border border-border px-3 py-3 text-left transition-all",
                        "hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10"
                      )}
                    >
                      <span className="text-xl">{a.emoji}</span>
                      <span className="text-sm font-medium text-foreground">{a.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Time selection */}
            {step === 'time' && !showCalendar && (
              <motion.div
                key="time"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Activity badge */}
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium">
                    {activityEmoji} {activityLabel}
                  </span>
                </div>

                {loadingSlots ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Finding the best times for everyone...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bestSlots.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Suggested times
                          </p>
                        </div>
                     {(() => {
                       // Group bestSlots by sharedCity
                       const groups: { city: string; slots: BestSlot[] }[] = [];
                       const seen = new Map<string, number>();
                       for (const bs of bestSlots) {
                         const key = bs.sharedCity || 'Unknown';
                         if (!seen.has(key)) {
                           seen.set(key, groups.length);
                           groups.push({ city: key, slots: [] });
                         }
                         groups[seen.get(key)!].slots.push(bs);
                       }
                       const multiCity = groups.length > 1;

                       return multiCity ? (
                         <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
                           {groups.map((g) => (
                             <div key={g.city} className="snap-start shrink-0 w-[85%] space-y-2">
                               <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                 <MapPin className="h-3 w-3 text-primary" />
                                 In {g.city}
                                 <span className="text-[10px] font-normal ml-1">({g.slots.length} times)</span>
                               </div>
                               {g.slots.map((bs, i) => (
                                 <SlotCard key={`${format(bs.date, 'yyyy-MM-dd')}-${bs.slot}`} bs={bs} i={i} onSelect={handleSelectSlot} />
                               ))}
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="space-y-2">
                           {bestSlots.map((bs, i) => (
                             <SlotCard key={`${format(bs.date, 'yyyy-MM-dd')}-${bs.slot}`} bs={bs} i={i} onSelect={handleSelectSlot} />
                           ))}
                         </div>
                       );
                     })()}
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-6 text-center">
                        <span className="text-2xl">🌎</span>
                        <p className="text-sm font-medium text-foreground">No overlapping times found</p>
                        <p className="text-xs text-muted-foreground max-w-[240px]">
                          It looks like you and {friendNamesStr} won't be in the same city in the next 6 months based on your schedules.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => setShowCalendar(true)}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      Pick a different date & time
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2b: Calendar picker */}
            {step === 'time' && showCalendar && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <button
                  onClick={() => setShowCalendar(false)}
                  className="flex items-center gap-1 text-xs text-primary font-medium"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to suggestions
                </button>
                <SlotCalendarPicker
                  selectedDate={selectedDate}
                  selectedSlot={timeSlot}
                  onSelect={handleCalendarSelect}
                  getSlotStatus={getSlotStatusForDate}
                  hasFriends={true}
                  days={180}
                />
              </motion.div>
            )}

            {/* STEP 3: Confirmation */}
            {step === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="space-y-4"
              >
                {/* Summary card */}
                <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{activityEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-foreground">{autoTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Proposed plan with {friendNamesStr}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">When</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedDate && (
                          isSameDay(selectedDate, new Date())
                            ? 'Today'
                            : isSameDay(selectedDate, addDays(new Date(), 1))
                              ? 'Tomorrow'
                              : format(selectedDate, 'EEE, MMM d')
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{timeSlot && SLOT_LABELS[timeSlot]}</p>
                      {selectedSharedCity && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary mt-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {selectedSharedCity}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">With</p>
                      <div className="flex -space-x-1.5 mt-1">
                        {preSelectedFriends.slice(0, 4).map(f => (
                          <Avatar key={f.userId} className="h-6 w-6 border-2 border-background">
                            <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                            <AvatarFallback className="text-[7px]">{f.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-primary dark:text-primary">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium">
                    💡 Proposed
                  </span>
                  <span className="text-muted-foreground">— confirmed when they accept</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step === 'confirm' && (
          <DrawerFooter className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={sending}
              className="w-full gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Send Plan Suggestion →
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
