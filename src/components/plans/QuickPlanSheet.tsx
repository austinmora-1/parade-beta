import { useState, useEffect, useRef, useCallback } from 'react';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { format, addDays, nextSaturday } from 'date-fns';
import { motion } from 'framer-motion';
import { CalendarPlus, MapPin, ChevronDown, Loader2, ArrowRight, X, CircleCheck, CircleHelp, Lightbulb } from 'lucide-react';
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

interface QuickPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedFriend?: {
    userId: string;
    name: string;
    avatar?: string;
  };
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
  preSelectedDate,
  preSelectedTimeSlot,
}: QuickPlanSheetProps) {
  const { proposePlan, addPlan, friends } = usePlannerStore();

  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [planStatus, setPlanStatus] = useState<PlanStatus>('confirmed');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<{ userId: string; name: string; avatar?: string } | null>(null);
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
      setSelectedDate(preSelectedDate || null);
      setTimeSlot(preSelectedTimeSlot || null);
      setShowDetails(false);
      setLocation('');
      setNote('');
      setSending(false);
      setPlanStatus(preSelectedFriend ? 'proposed' : 'confirmed');
      setCalendarOpen(false);
      setSelectedFriend(preSelectedFriend || null);
      setFriendSearch('');
      setLocationSuggestions([]);
    }
  }, [open, preSelectedFriend, preSelectedDate, preSelectedTimeSlot]);

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const weekend = nextSaturday(today);

  const dateOptions = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: tomorrow },
    { label: format(weekend, 'EEE d'), date: weekend },
  ];

  const connectedFriends = friends.filter(f => f.status === 'connected' && f.friendUserId);
  const filteredFriends = friendSearch
    ? connectedFriends.filter(f => f.name.toLowerCase().includes(friendSearch.toLowerCase()))
    : connectedFriends.slice(0, 5);

  const hasFriend = !!selectedFriend || !!preSelectedFriend;
  const canSubmit = !!activity && !!selectedDate && !!timeSlot;

  // Auto-set status to proposed when a friend is selected
  const effectiveStatus = hasFriend ? 'proposed' as PlanStatus : planStatus;

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

    const friend = selectedFriend || preSelectedFriend;

    if (friend) {
      await proposePlan({
        recipientFriendId: friend.userId,
        activity: activity!,
        date: selectedDate!,
        timeSlot: timeSlot!,
        location: location || undefined,
        note: note || undefined,
      });

      confetti({
        particleCount: 80,
        spread: 55,
        origin: { y: 0.75 },
        colors: ['#3D8C6C', '#FF6B6B', '#F59E0B', '#8B5CF6', '#3B82F6'],
        scalar: 0.9,
      });
      toast.success(`Plan suggestion sent to ${friend.name}! 🎉`);
    } else {
      const activityConfig = ACTIVITY_CONFIG[activity! as ActivityType];
      await addPlan({
        title: activityConfig?.label || activity!,
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
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center">
              {hasFriend ? 'Suggest a Plan' : 'Quick Plan'}
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-2 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Friend display */}
            {(preSelectedFriend || selectedFriend) && (
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={(preSelectedFriend || selectedFriend)?.avatar || getElephantAvatar((preSelectedFriend || selectedFriend)?.name || '')} />
                  <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                    {(preSelectedFriend || selectedFriend)?.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{(preSelectedFriend || selectedFriend)?.name.split(' ')[0]}</span>
                {!preSelectedFriend && selectedFriend && (
                  <button onClick={() => { setSelectedFriend(null); setPlanStatus('confirmed'); }} className="ml-auto p-1 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Friend picker when no pre-selected friend */}
            {!preSelectedFriend && !selectedFriend && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  With (optional)
                </p>
                <Input
                  placeholder="Search friends..."
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="h-8 text-sm"
                />
                {filteredFriends.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {filteredFriends.slice(0, 6).map(f => (
                      <button
                        key={f.id}
                        onClick={() => { setSelectedFriend({ userId: f.friendUserId!, name: f.name, avatar: f.avatar }); setPlanStatus('proposed'); }}
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

            {/* Activity chips */}
            <div className="space-y-2">
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

            {/* Time slot chips */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Time</p>
              <div className="flex gap-1.5 flex-wrap">
                {TIME_SLOTS.map(t => (
                  <motion.button
                    key={t.value}
                    whileTap={{ scale: 0.92 }}
                    transition={chipSpring}
                    onClick={() => setTimeSlot(t.value)}
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                      timeSlot === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {t.label}
                  </motion.button>
                ))}
              </div>
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
            {hasFriend && (
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
              {hasFriend ? 'Send Plan Suggestion →' : 'Add to My Plans'}
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
      />
    </>
  );
}
