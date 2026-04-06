import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { format, addDays, nextSaturday, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, MapPin, ChevronDown, Loader2, ArrowRight, X, CircleCheck, CircleHelp, Lightbulb, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePlannerStore } from '@/stores/plannerStore';
import {
  ACTIVITY_CONFIG,
  TIME_SLOT_LABELS,
  ActivityType,
  TimeSlot,
  PlanStatus,
  Friend,
} from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { usePods } from '@/hooks/usePods';
import { Users } from 'lucide-react';

interface QuickPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedFriend?: {
    userId: string;
    name: string;
    avatar?: string;
  };
  preSelectedFriends?: {
    userId: string;
    name: string;
    avatar?: string;
  }[];
  preSelectedDate?: Date;
  preSelectedTimeSlot?: TimeSlot;
}

const QUICK_ACTIVITIES: { id: ActivityType; emoji: string; label: string }[] = [
  { id: 'drinks', emoji: '🍹', label: 'Drinks' },
  { id: 'getting-food', emoji: '🍽️', label: 'Food' },
  { id: 'coffee', emoji: '☕', label: 'Coffee' },
  { id: 'events', emoji: '🎉', label: 'Events' },
  { id: 'movies', emoji: '🎬', label: 'Movies' },
  { id: 'workout-out', emoji: '🏋️', label: 'Active' },
  { id: 'game-night', emoji: '🎲', label: 'Games' },
  { id: 'other-events', emoji: '✨', label: 'Hangout' },
];

const TIME_SLOTS: { label: string; value: TimeSlot }[] = [
  { label: 'Morning', value: 'late-morning' },
  { label: 'Lunch', value: 'early-afternoon' },
  { label: 'Afternoon', value: 'late-afternoon' },
  { label: 'Evening', value: 'evening' },
  { label: 'Late Night', value: 'late-night' },
];

const chipSpring = { type: 'spring' as const, stiffness: 500, damping: 25 };

interface LocationSuggestion {
  display_name: string;
  place_id?: string;
}

export function QuickPlanSheet({
  open,
  onOpenChange,
  preSelectedFriend,
  preSelectedFriends,
  preSelectedDate,
  preSelectedTimeSlot,
}: QuickPlanSheetProps) {
  const { proposePlan, addPlan, friends, userId } = usePlannerStore();

  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [planStatus, setPlanStatus] = useState<PlanStatus>('confirmed');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<{ userId: string; name: string; avatar?: string }[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Location search
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const locationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const viewport = useVisualViewport();

  // Scroll focused input into view when keyboard opens
  const handleInputFocus = useCallback(() => {
    // Small delay to let the keyboard finish animating
    setTimeout(() => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && scrollContainerRef.current?.contains(activeEl)) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  }, []);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setActivity(null);
      setTitle('');
      setSelectedDate(preSelectedDate || null);
      setTimeSlot(preSelectedTimeSlot || null);
      setShowDetails(false);
      setLocation('');
      setNote('');
      setSending(false);
      const initialFriends = preSelectedFriends?.length
        ? preSelectedFriends
        : preSelectedFriend
          ? [preSelectedFriend]
          : [];
      setPlanStatus(initialFriends.length > 0 ? 'proposed' : 'confirmed');
      setCalendarOpen(false);
      setSelectedFriends(initialFriends);
      setFriendSearch('');
      setLocationSuggestions([]);
    }
  }, [open, preSelectedFriend, preSelectedFriends, preSelectedDate, preSelectedTimeSlot]);

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const weekend = nextSaturday(today);

  const dateOptions = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: tomorrow },
    { label: format(weekend, 'EEE d'), date: weekend },
  ];

  const { pods } = usePods();
  const connectedFriends = friends.filter(f => f.status === 'connected' && f.friendUserId);
  const selectedUserIds = new Set(selectedFriends.map(sf => sf.userId));
  const filteredFriends = (friendSearch
    ? connectedFriends.filter(f => f.name.toLowerCase().includes(friendSearch.toLowerCase()))
    : connectedFriends.slice(0, 5)
  ).filter(f => !selectedUserIds.has(f.friendUserId!));

  const handleAddPod = (pod: typeof pods[0]) => {
    const newFriends: typeof selectedFriends = [];
    for (const memberId of pod.memberUserIds) {
      if (!selectedUserIds.has(memberId)) {
        const friend = connectedFriends.find(f => f.friendUserId === memberId);
        if (friend) {
          newFriends.push({ userId: friend.friendUserId!, name: friend.name, avatar: friend.avatar });
        }
      }
    }
    if (newFriends.length > 0) {
      setSelectedFriends(prev => [...prev, ...newFriends]);
      setPlanStatus('proposed');
    }
    setFriendSearch('');
  };

  // Fetch availability for selected friends on the selected date
  const [friendSlotAvailability, setFriendSlotAvailability] = useState<Record<TimeSlot, { free: number; total: number }>>({} as any);

  useEffect(() => {
    if (selectedFriends.length === 0 || !selectedDate) {
      setFriendSlotAvailability({} as any);
      return;
    }

    const fetchAvail = async () => {
      const userIds = selectedFriends.map(f => f.userId);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data } = await supabase
        .from('availability')
        .select('*')
        .in('user_id', userIds)
        .eq('date', dateStr);

      // Also check if friends have plans blocking slots
      const { data: friendPlans } = await supabase
        .from('plans')
        .select('time_slot, user_id, date, status')
        .in('user_id', userIds)
        .eq('date', dateStr)
        .in('status', ['confirmed', 'proposed']);

      const slotMap = {} as Record<TimeSlot, { free: number; total: number }>;
      const allSlots: TimeSlot[] = ['late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];

      for (const slot of allSlots) {
        let freeCount = 0;
        for (const uid of userIds) {
          const row = (data || []).find(d => d.user_id === uid);
          const colName = slot.replace(/-/g, '_') as keyof typeof row;
          const isAvailable = row ? (row[colName] ?? true) : true;
          const hasPlan = (friendPlans || []).some(p => p.user_id === uid && p.time_slot === slot);
          if (isAvailable && !hasPlan) freeCount++;
        }
        slotMap[slot] = { free: freeCount, total: userIds.length };
      }

      setFriendSlotAvailability(slotMap);
    };

    fetchAvail();
  }, [selectedFriends, selectedDate]);

  // Also factor in my own availability
  const { availabilityMap: myAvailabilityMap, plans: myPlans } = usePlannerStore();

  const getSlotStatus = useCallback((slot: TimeSlot): 'all-free' | 'some-free' | 'none-free' | null => {
    if (selectedFriends.length === 0 || !selectedDate) return null;
    const avail = friendSlotAvailability[slot];
    if (!avail) return null;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const myDay = myAvailabilityMap[dateStr];
    const myFree = myDay ? myDay.slots[slot] : true;
    const myBusy = myPlans.some(p => isSameDay(p.date, selectedDate) && p.timeSlot === slot);
    const iAmFree = myFree && !myBusy;

    if (iAmFree && avail.free === avail.total) return 'all-free';
    if (iAmFree && avail.free > 0) return 'some-free';
    if (!iAmFree || avail.free === 0) return 'none-free';
    return null;
  }, [friendSlotAvailability, selectedDate, selectedFriends, myAvailabilityMap, myPlans]);

  // Auto-select best available time slot when friends + date are set
  useEffect(() => {
    if (selectedFriends.length === 0 || !selectedDate || Object.keys(friendSlotAvailability).length === 0) return;
    // Don't override if user already picked a slot manually
    if (timeSlot) return;

    const slotPriority: TimeSlot[] = ['late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const myDay = myAvailabilityMap[dateStr];

    // First pass: find "all-free" slot
    for (const slot of slotPriority) {
      const avail = friendSlotAvailability[slot];
      if (!avail) continue;
      const myFree = myDay ? myDay.slots[slot] : true;
      const myBusy = myPlans.some(p => isSameDay(p.date, selectedDate) && p.timeSlot === slot);
      if (myFree && !myBusy && avail.free === avail.total) {
        setTimeSlot(slot);
        return;
      }
    }
    // Second pass: find "some-free" slot
    for (const slot of slotPriority) {
      const avail = friendSlotAvailability[slot];
      if (!avail) continue;
      const myFree = myDay ? myDay.slots[slot] : true;
      const myBusy = myPlans.some(p => isSameDay(p.date, selectedDate) && p.timeSlot === slot);
      if (myFree && !myBusy && avail.free > 0) {
        setTimeSlot(slot);
        return;
      }
    }
  }, [friendSlotAvailability, selectedDate, selectedFriends]);

  // Best date+time suggestions across next 7 days
  interface BestSlot {
    date: Date;
    slot: TimeSlot;
    status: 'all-free' | 'some-free';
    freeCount: number;
    total: number;
  }
  const [bestSlots, setBestSlots] = useState<BestSlot[]>([]);
  const [loadingBestSlots, setLoadingBestSlots] = useState(false);

  useEffect(() => {
    if (selectedFriends.length === 0) {
      setBestSlots([]);
      return;
    }

    const fetchBestSlots = async () => {
      setLoadingBestSlots(true);
      const userIds = selectedFriends.map(f => f.userId);
      const scanDays = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
      const startDate = format(scanDays[0], 'yyyy-MM-dd');
      const endDate = format(scanDays[6], 'yyyy-MM-dd');

      const [{ data: availData }, { data: plansData }] = await Promise.all([
        supabase.from('availability').select('*').in('user_id', userIds).gte('date', startDate).lte('date', endDate),
        supabase.from('plans').select('time_slot, user_id, date, status').in('user_id', userIds).gte('date', startDate).lte('date', endDate).in('status', ['confirmed', 'proposed']),
      ]);

      const allSlots: TimeSlot[] = ['late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];
      const results: BestSlot[] = [];

      for (const day of scanDays) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const myDay = myAvailabilityMap[dateStr];

        for (const slot of allSlots) {
          const myFree = myDay ? myDay.slots[slot] : true;
          const myBusy = myPlans.some(p => isSameDay(p.date, day) && p.timeSlot === slot);
          if (!myFree || myBusy) continue;

          let freeCount = 0;
          for (const uid of userIds) {
            const row = (availData || []).find(d => d.user_id === uid && d.date === dateStr);
            const colName = slot.replace(/-/g, '_') as string;
            const isAvailable = row ? ((row as any)[colName] ?? true) : true;
            const hasPlan = (plansData || []).some(p => p.user_id === uid && p.time_slot === slot && p.date?.startsWith(dateStr));
            if (isAvailable && !hasPlan) freeCount++;
          }

          if (freeCount > 0) {
            results.push({
              date: day,
              slot,
              status: freeCount === userIds.length ? 'all-free' : 'some-free',
              freeCount,
              total: userIds.length,
            });
          }
        }
      }

      // Sort: all-free first, then by date, then by slot order
      const slotOrder: Record<string, number> = { 'late-morning': 0, 'early-afternoon': 1, 'late-afternoon': 2, 'evening': 3, 'late-night': 4 };
      results.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'all-free' ? -1 : 1;
        const dateDiff = a.date.getTime() - b.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return (slotOrder[a.slot] || 0) - (slotOrder[b.slot] || 0);
      });

      setBestSlots(results.slice(0, 6));
      setLoadingBestSlots(false);
    };

    fetchBestSlots();
  }, [selectedFriends, myAvailabilityMap, myPlans]);

  const slotLabelMap: Record<string, string> = {
    'late-morning': 'Morning',
    'early-afternoon': 'Lunch',
    'late-afternoon': 'Afternoon',
    'evening': 'Evening',
    'late-night': 'Late Night',
  };

  const handleBestSlotClick = (bs: BestSlot) => {
    setSelectedDate(bs.date);
    setTimeSlot(bs.slot);
    setCalendarOpen(false);
  };

  const hasFriends = selectedFriends.length > 0;
  const canSubmit = !!activity && !!selectedDate && !!timeSlot;

  // Auto-set status to proposed when friends are selected
  const effectiveStatus = hasFriends ? 'proposed' as PlanStatus : planStatus;

  const handleLocationChange = (value: string) => {
    setLocation(value);
    if (locationTimeoutRef.current) clearTimeout(locationTimeoutRef.current);
    if (value.length < 2) {
      setLocationSuggestions([]);
      return;
    }
    locationTimeoutRef.current = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const { data, error } = await supabase.functions.invoke('google-places-search', {
          body: { query: value, types: 'establishment' },
        });
        if (!error && data?.suggestions) {
          setLocationSuggestions(data.suggestions.map((s: any) => ({
            display_name: s.main_text ? `${s.main_text}${s.secondary_text ? `, ${s.secondary_text}` : ''}` : s.display_name,
            place_id: s.place_id,
          })));
        }
      } catch {
        // ignore
      }
      setIsSearchingLocation(false);
    }, 300);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);

    if (hasFriends) {
      // Propose plan with first friend as primary recipient, then add others as participants
      const firstFriend = selectedFriends[0];
      await proposePlan({
        recipientFriendId: firstFriend.userId,
        activity: activity!,
        date: selectedDate!,
        timeSlot: timeSlot!,
        title: title.trim() || undefined,
        location: location || undefined,
        note: note || undefined,
      });

      // If there are additional friends, add them as participants to the most recent plan
      if (selectedFriends.length > 1) {
        // Fetch the just-created plan
        const { data: latestPlan } = await supabase
          .from('plans')
          .select('id')
          .eq('user_id', userId || '')
          .eq('status', 'proposed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestPlan) {
          const additionalParticipants = selectedFriends.slice(1).map(f => ({
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
      const friendNames = selectedFriends.map(f => f.name.split(' ')[0]).join(', ');
      toast.success(`Plan suggestion sent to ${friendNames}! 🎉`);
    } else {
      const activityConfig = ACTIVITY_CONFIG[activity! as ActivityType];
      await addPlan({
        title: title.trim() || activityConfig?.label || activity!,
        activity: activity!,
        date: selectedDate!,
        timeSlot: timeSlot!,
        duration: 60,
        location: location ? { id: 'loc', name: location, address: '' } : undefined,
        notes: note || undefined,
        status: planStatus,
        participants: [],
      });
      toast.success('Plan added!');
    }

    setSending(false);
    onOpenChange(false);
  };

  const handleMoreOptions = () => {
    setShowMoreOptions(true);
    onOpenChange(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent 
          className="max-h-[90vh]"
          style={viewport ? { maxHeight: `${Math.min(viewport.height * 0.9, window.innerHeight * 0.9)}px` } : undefined}
        >
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center">
              {hasFriends ? 'Suggest a Plan' : 'Quick Plan'}
            </DrawerTitle>
          </DrawerHeader>

          <div ref={scrollContainerRef} className="px-4 pb-2 space-y-4 overflow-y-auto flex-1 min-h-0" onFocus={handleInputFocus}>
            {/* Plan title */}
            <Input
              placeholder="Plan title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-sm"
            />

            {/* Selected friends display */}
            {selectedFriends.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  With
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {selectedFriends.map(f => (
                    <span
                      key={f.userId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                        <AvatarFallback className="text-[6px]">{f.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {f.name.split(' ')[0]}
                      {!preSelectedFriend && (
                        <button
                          onClick={() => {
                            const updated = selectedFriends.filter(sf => sf.userId !== f.userId);
                            setSelectedFriends(updated);
                            if (updated.length === 0) setPlanStatus('confirmed');
                          }}
                          className="ml-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Friend picker */}
            {!preSelectedFriend && (
              <div className="space-y-2">
                {selectedFriends.length === 0 && (
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    With (optional)
                  </p>
                )}
                <Input
                  placeholder="Search friends..."
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="h-8 text-sm"
                />
                {/* Pod chips */}
                {pods.length > 0 && !friendSearch && (
                  <div className="flex gap-1.5 flex-wrap">
                    {pods.map(pod => (
                      <button
                        key={pod.id}
                        onClick={() => handleAddPod(pod)}
                        className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                      >
                        <Users className="h-3 w-3" />
                        {pod.emoji} {pod.name}
                      </button>
                    ))}
                  </div>
                )}
                {filteredFriends.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {filteredFriends.slice(0, 6).map(f => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setSelectedFriends(prev => [...prev, { userId: f.friendUserId!, name: f.name, avatar: f.avatar }]);
                          setPlanStatus('proposed');
                          setFriendSearch('');
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                          <AvatarFallback className="text-[6px]">{f.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {f.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}


            {/* Best time suggestions */}
            <AnimatePresence>
              {hasFriends && bestSlots.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Best times
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {bestSlots.map((bs, i) => {
                      const isSelected = selectedDate && timeSlot &&
                        format(selectedDate, 'yyyy-MM-dd') === format(bs.date, 'yyyy-MM-dd') &&
                        timeSlot === bs.slot;
                      return (
                        <motion.button
                          key={`${format(bs.date, 'yyyy-MM-dd')}-${bs.slot}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => handleBestSlotClick(bs)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : bs.status === 'all-free'
                                ? "border-availability-available/40 bg-availability-available/5 hover:bg-availability-available/10 text-foreground"
                                : "border-availability-partial/30 bg-availability-partial/5 hover:bg-availability-partial/10 text-foreground"
                          )}
                        >
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            isSelected
                              ? "bg-primary-foreground/60"
                              : bs.status === 'all-free'
                                ? "bg-availability-available"
                                : "bg-availability-partial"
                          )} />
                          <span>{isSameDay(bs.date, new Date()) ? 'Today' : format(bs.date, 'EEE d')}</span>
                          <span className={cn(
                            "text-[10px]",
                            isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {slotLabelMap[bs.slot]}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {hasFriends && loadingBestSlots && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Finding best times...
              </div>
            )}

            {/* Date chips */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">When</p>
              <div className="flex gap-1.5 flex-wrap">
                {dateOptions.map(d => (
                  <motion.button
                    key={d.label}
                    whileTap={{ scale: 0.92 }}
                    transition={chipSpring}
                    onClick={() => { setSelectedDate(d.date); setCalendarOpen(false); }}
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                      selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(d.date, 'yyyy-MM-dd')
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {d.label}
                  </motion.button>
                ))}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      transition={chipSpring}
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                        selectedDate && !dateOptions.some(d => format(d.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {selectedDate && !dateOptions.some(d => format(d.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
                        ? format(selectedDate, 'EEE d')
                        : 'Pick date ↗'}
                    </motion.button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate || undefined}
                      onSelect={(date) => { if (date) { setSelectedDate(date); setCalendarOpen(false); }}}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Time</p>
              <div className="flex gap-1.5 flex-wrap">
                {TIME_SLOTS.map(t => {
                  const status = getSlotStatus(t.value);
                  return (
                    <motion.button
                      key={t.value}
                      whileTap={{ scale: 0.92 }}
                      transition={chipSpring}
                      onClick={() => setTimeSlot(t.value)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm font-medium transition-colors relative",
                        timeSlot === t.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : status === 'none-free'
                            ? "border-border text-muted-foreground/40 line-through"
                            : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {status === 'all-free' && timeSlot !== t.value && (
                          <span className="h-1.5 w-1.5 rounded-full bg-availability-available inline-block" />
                        )}
                        {status === 'some-free' && timeSlot !== t.value && (
                          <span className="h-1.5 w-1.5 rounded-full bg-availability-partial inline-block" />
                        )}
                        {t.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              {hasFriends && selectedDate && (
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-availability-available inline-block" />
                    All free
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-availability-partial inline-block" />
                    Some free
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="line-through">Busy</span>
                  </div>
                </div>
              )}
            </div>

            {/* Optional details */}
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")} />
                {showDetails ? 'Hide details' : '+ Add details'}
              </button>
              {showDetails && (
                <div className="mt-2 space-y-3 animate-fade-in">
                  {/* Activity chips */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Activity</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {QUICK_ACTIVITIES.map(a => (
                        <motion.button
                          key={a.id}
                          whileTap={{ scale: 0.92 }}
                          transition={chipSpring}
                          onClick={() => setActivity(a.id)}
                          className={cn(
                            "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                            activity === a.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          )}
                        >
                          {a.emoji} {a.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  {/* Status selector */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                    <div className="flex gap-1.5">
                      {([
                        { value: 'confirmed' as PlanStatus, icon: CircleCheck, label: 'Confirmed', activeClass: 'bg-primary/10 text-primary border-primary' },
                        { value: 'tentative' as PlanStatus, icon: CircleHelp, label: 'Tentative', activeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500' },
                        { value: 'proposed' as PlanStatus, icon: Lightbulb, label: 'Proposed', activeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500' },
                      ]).map(s => {
                        const Icon = s.icon;
                        return (
                          <button
                            key={s.value}
                            onClick={() => setPlanStatus(s.value)}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1.5 rounded-full border px-2 py-1.5 text-xs font-medium transition-colors",
                              planStatus === s.value
                                ? s.activeClass
                                : "border-border text-muted-foreground hover:border-primary/30"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      placeholder="Where?"
                      value={location}
                      onChange={(e) => handleLocationChange(e.target.value)}
                      className="h-9 text-sm pl-8"
                    />
                    <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    {isSearchingLocation && (
                      <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {locationSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-md max-h-40 overflow-y-auto">
                        {locationSuggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setLocation(s.display_name);
                              setLocationSuggestions([]);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors truncate"
                          >
                            {s.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Textarea
                    placeholder="Add a message (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <DrawerFooter className="pt-2">
            {hasFriends && (
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 mb-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 font-medium">
                  💡 Status: Proposed
                </span>
                <span className="text-muted-foreground">— confirmed when they accept</span>
              </div>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || sending}
              className="w-full gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              {hasFriends ? 'Send Plan Suggestion →' : 'Add to My Plans'}
            </Button>
            <button
              onClick={handleMoreOptions}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
            >
              More options →
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Escape hatch to full CreatePlanDialog */}
      <CreatePlanDialog
        open={showMoreOptions}
        onOpenChange={(v) => { if (!v) setShowMoreOptions(false); }}
        defaultDate={selectedDate || undefined}
        defaultActivity={activity || undefined}
        defaultTimeSlot={timeSlot || undefined}
        defaultLocation={location || undefined}
        defaultNotes={note || undefined}
        defaultStatus={effectiveStatus}
        defaultFriendUserIds={selectedFriends.map(f => f.userId)}
        defaultTitle={title.trim() || undefined}
      />
    </>
  );
}
