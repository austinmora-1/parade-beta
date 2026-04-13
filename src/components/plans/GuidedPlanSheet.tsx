import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarPlus, Loader2, ArrowLeft, Sparkles, CalendarDays, Check,
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
}

const SLOT_LABELS: Record<string, string> = {
  'late-morning': 'Morning',
  'early-afternoon': 'Lunch',
  'late-afternoon': 'Afternoon',
  'evening': 'Evening',
  'late-night': 'Late Night',
};


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
    const [{ data: availData }, { data: plansData }, { data: friendProfiles }] = await Promise.all([
      supabase.from('availability').select('*').in('user_id', allUserIds).gte('date', startDate).lte('date', endDate),
      supabase.from('plans').select('time_slot, user_id, date, status').in('user_id', allUserIds).gte('date', startDate).lte('date', endDate).in('status', ['confirmed', 'proposed']),
      supabase.from('profiles').select('user_id, home_address').in('user_id', userIds),
    ]);

    // Build friend home address map
    const friendHomeMap = new Map<string, string | null>();
    for (const p of (friendProfiles || [])) {
      friendHomeMap.set(p.user_id, p.home_address);
    }

    const allSlots: TimeSlot[] = ['late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];
    const results: BestSlot[] = [];
    const multiDay: typeof friendMultiDayAvail = {};

    for (const day of scanDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const slotMap = {} as Record<TimeSlot, { free: number; total: number }>;

      // Get my availability — prefer store data, fall back to fetched data for dates beyond store range
      let myDay = myAvailabilityMap[dateStr];
      if (!myDay && userId) {
        const myRow = (availData || []).find(d => d.user_id === userId && d.date === dateStr);
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

      // Get my effective city for this date
      const myLocStatus = myDay?.locationStatus || 'home';
      const myTripLoc = myDay?.tripLocation || null;
      const myCity = getEffectiveCity(myLocStatus, myTripLoc, homeAddress);

      for (const slot of allSlots) {
        const myFree = myDay ? myDay.slots[slot] : true;
        const myBusy = myPlans.some(p => isSameDay(p.date, day) && p.timeSlot === slot);
        const iAmFree = myFree && !myBusy;

        let freeCount = 0;
        for (const uid of userIds) {
          const row = (availData || []).find(d => d.user_id === uid && d.date === dateStr);
          const colName = slot.replace(/-/g, '_') as string;
          const isAvailable = row ? ((row as any)[colName] ?? true) : true;
          const hasPlan = (plansData || []).some(p => p.user_id === uid && p.time_slot === slot && p.date?.startsWith(dateStr));

          // Check co-location
          const friendLocStatus = row?.location_status || 'home';
          const friendTripLoc = row?.trip_location || null;
          const friendHome = friendHomeMap.get(uid) || null;
          const friendCity = getEffectiveCity(friendLocStatus, friendTripLoc, friendHome);
          const coLocated = !myCity || !friendCity || citiesMatch(myCity, friendCity);

          if (isAvailable && !hasPlan && coLocated) freeCount++;
        }
        slotMap[slot] = { free: freeCount, total: userIds.length };

        if (iAmFree && freeCount > 0) {
          results.push({
            date: day,
            slot,
            status: freeCount === userIds.length ? 'all-free' : 'some-free',
            freeCount,
            total: userIds.length,
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

    const top = results.slice(0, 3);
    setBestSlots(top);
    setLoadingSlots(false);
  }, [preSelectedFriends, myAvailabilityMap, myPlans, homeAddress]);

  // Fetch extended availability (180 days) when calendar is opened
  const fetchExtendedAvail = useCallback(async () => {
    if (preSelectedFriends.length === 0) return;
    const userIds = preSelectedFriends.map(f => f.userId);
    const startDate = format(addDays(new Date(), 14), 'yyyy-MM-dd'); // skip first 14 already fetched
    const endDate = format(addDays(new Date(), 180), 'yyyy-MM-dd');

    const [{ data: availData }, { data: plansData }, { data: friendProfiles }] = await Promise.all([
      supabase.from('availability').select('*').in('user_id', userIds).gte('date', startDate).lte('date', endDate),
      supabase.from('plans').select('time_slot, user_id, date, status').in('user_id', userIds).gte('date', startDate).lte('date', endDate).in('status', ['confirmed', 'proposed']),
      supabase.from('profiles').select('user_id, home_address').in('user_id', userIds),
    ]);

    const friendHomeMap = new Map<string, string | null>();
    for (const p of (friendProfiles || [])) {
      friendHomeMap.set(p.user_id, p.home_address);
    }

    const allSlots: TimeSlot[] = ['late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];
    const extended: typeof friendMultiDayAvail = {};

    for (let i = 14; i <= 180; i++) {
      const day = addDays(new Date(), i);
      const dateStr = format(day, 'yyyy-MM-dd');
      const slotMap = {} as Record<TimeSlot, { free: number; total: number }>;

      // Get my effective city for this date
      const myDay = myAvailabilityMap[dateStr];
      const myCity = getEffectiveCity(myDay?.locationStatus || 'home', myDay?.tripLocation || null, homeAddress);

      for (const slot of allSlots) {
        let freeCount = 0;
        for (const uid of userIds) {
          const row = (availData || []).find(d => d.user_id === uid && d.date === dateStr);
          const colName = slot.replace(/-/g, '_') as string;
          const isAvailable = row ? ((row as any)[colName] ?? true) : true;
          const hasPlan = (plansData || []).some(p => p.user_id === uid && p.time_slot === slot && p.date?.startsWith(dateStr));

          // Check co-location
          const friendLocStatus = row?.location_status || 'home';
          const friendTripLoc = row?.trip_location || null;
          const friendHome = friendHomeMap.get(uid) || null;
          const friendCity = getEffectiveCity(friendLocStatus, friendTripLoc, friendHome);
          const coLocated = !myCity || !friendCity || citiesMatch(myCity, friendCity);

          if (isAvailable && !hasPlan && coLocated) freeCount++;
        }
        slotMap[slot] = { free: freeCount, total: userIds.length };
      }
      extended[dateStr] = slotMap;
    }

    setFriendMultiDayAvail(prev => ({ ...prev, ...extended }));
  }, [preSelectedFriends, myAvailabilityMap, homeAddress]);

  // When step changes to 'time', fetch initial best slots
  useEffect(() => {
    if (step === 'time') {
      fetchBestSlots();
    }
  }, [step]);

  // When calendar is shown, fetch extended availability
  useEffect(() => {
    if (showCalendar) {
      fetchExtendedAvail();
    }
  }, [showCalendar]);

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
                        <div className="space-y-2">
                          {bestSlots.map((bs, i) => {
                            const isWeekend = [0, 6].includes(bs.date.getDay());
                            const dayLabel = isSameDay(bs.date, new Date())
                              ? 'Today'
                              : isSameDay(bs.date, addDays(new Date(), 1))
                                ? 'Tomorrow'
                                : format(bs.date, 'EEEE, MMM d');

                            return (
                              <motion.button
                                key={`${format(bs.date, 'yyyy-MM-dd')}-${bs.slot}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                                onClick={() => handleSelectSlot(bs)}
                                className={cn(
                                  "w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
                                  bs.status === 'all-free'
                                    ? "border-availability-available/40 bg-availability-available/5 hover:bg-availability-available/10"
                                    : "border-border hover:border-primary/30 hover:bg-primary/5"
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{dayLabel}</p>
                                  <p className="text-xs text-muted-foreground">{SLOT_LABELS[bs.slot]}</p>
                                </div>
                                {bs.status === 'all-free' && bs.total > 0 ? (
                                  <span className="text-[10px] font-medium text-availability-available bg-availability-available/10 rounded-full px-2 py-0.5">
                                    Everyone's free ✓
                                  </span>
                                ) : bs.total > 0 ? (
                                  <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                                    {bs.freeCount}/{bs.total} free
                                  </span>
                                ) : null}
                              </motion.button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-6 text-center">
                        <span className="text-2xl">🌎</span>
                        <p className="text-sm font-medium text-foreground">No overlapping times found</p>
                        <p className="text-xs text-muted-foreground max-w-[240px]">
                          It looks like you and {friendNamesStr} won't be in the same city in the next 2 weeks. Try picking a date further out.
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
