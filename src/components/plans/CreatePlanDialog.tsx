import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Users, Clock, Search, Loader2, AlertTriangle, Eye, Globe, Lock, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Button } from '@/components/ui/button';
import { AvailabilityWarning } from '@/components/plans/AvailabilityWarning';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlannerStore } from '@/stores/plannerStore';
import { 
  ACTIVITY_CONFIG, 
  VIBE_CONFIG,
  TIME_SLOT_LABELS, 
  ActivityType, 
  VibeType,
  TimeSlot, 
  Plan,
  PlanStatus,
  FeedVisibility,
  getActivitiesByVibe,
  getAllVibes
} from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { usePlanChangeRequests } from '@/hooks/usePlanChangeRequests';
import { usePods } from '@/hooks/usePods';
import { useRecurringPlans } from '@/hooks/useRecurringPlans';
import { toast } from 'sonner';

interface PlaceSuggestion {
  place_id: string;
  display_name: string;
  main_text: string;
  secondary_text: string;
}

interface LocationSuggestion {
  display_name: string;
  place_id?: string;
}

/** Generate 15-minute interval time options for select dropdowns */
function generateTimeOptions() {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
      options.push({ value, label });
    }
  }
  return options;
}

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPlan?: Plan | null;
  defaultDate?: Date;
  onChangeProposed?: () => void;
}

export function CreatePlanDialog({ open, onOpenChange, editPlan, defaultDate, onChangeProposed }: CreatePlanDialogProps) {
  const { addPlan, updatePlan, friends, userId, plans } = usePlannerStore();
  const { proposeChange, checkParticipantAvailability } = usePlanChangeRequests();
  const { pods } = usePods();
  const { createRecurringPlan } = useRecurringPlans();
  const [title, setTitle] = useState('');
  const [selectedVibe, setSelectedVibe] = useState<VibeType>('social');
  const [activity, setActivity] = useState<ActivityType | string>('drinks');
  const [date, setDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('late-morning');
  const [duration, setDuration] = useState('60');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [subscriberFriends, setSubscriberFriends] = useState<string[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [planStatus, setPlanStatus] = useState<PlanStatus>('confirmed');
  const [feedVisibility, setFeedVisibility] = useState<FeedVisibility>('private');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [recurrenceWeekOfMonth, setRecurrenceWeekOfMonth] = useState<number>(1);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Shared plan change request state
  const [participantAvailability, setParticipantAvailability] = useState<{ userId: string; name: string; available: boolean }[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isProposing, setIsProposing] = useState(false);

  // Auto-calculate duration when both start and end times are set
  useEffect(() => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const diffMin = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMin > 0) {
        // Snap to nearest valid duration option
        const options = [30, 60, 90, 120, 180];
        const closest = options.reduce((prev, curr) =>
          Math.abs(curr - diffMin) < Math.abs(prev - diffMin) ? curr : prev
        );
        setDuration(closest.toString());
      }
    }
  }, [startTime, endTime]);

  // Get activities for selected vibe
  const vibeActivities = getActivitiesByVibe(selectedVibe);

  // Search for locations using Google Places API via edge function
  const searchLocation = async (query: string) => {
    if (query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { 
          query, 
          types: 'establishment' // Search for businesses, restaurants, etc.
        },
      });

      if (error) throw error;

      const suggestions: LocationSuggestion[] = (data.suggestions || []).map((s: PlaceSuggestion) => ({
        display_name: `${s.main_text}${s.secondary_text ? ` · ${s.secondary_text}` : ''}`,
        place_id: s.place_id,
      }));

      setLocationSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching location:', error);
      setLocationSuggestions([]);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleLocationChange = (value: string) => {
    setLocationName(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(value);
    }, 300);
  };

  const selectLocation = (suggestion: LocationSuggestion) => {
    setLocationName(suggestion.display_name);
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  // Sync form state when editPlan changes or dialog opens
  useEffect(() => {
    if (open && editPlan) {
      setTitle(editPlan.title);
      setActivity(editPlan.activity);
      // Set vibe based on activity
      const config = ACTIVITY_CONFIG[editPlan.activity as ActivityType];
      if (config) {
        setSelectedVibe(config.vibeType);
      }
      setDate(editPlan.date);
      setEndDate(editPlan.endDate || undefined);
      setIsMultiDay(!!editPlan.endDate);
      setTimeSlot(editPlan.timeSlot);
      setDuration(editPlan.duration?.toString() || '60');
      setStartTime(editPlan.startTime || '');
      setEndTime(editPlan.endTime || '');
      setLocationName(editPlan.location?.name || '');
      // Map participant user IDs to friendship record IDs for the friend chips
      const participantUserIds = editPlan.participants.filter(p => p.role !== 'subscriber').map(p => p.friendUserId || p.id);
      const subscriberUserIds = editPlan.participants.filter(p => p.role === 'subscriber').map(p => p.friendUserId || p.id);
      const matchedFriendIds = friends
        .filter(f => f.status === 'connected' && participantUserIds.includes(f.friendUserId || ''))
        .map(f => f.id);
      const matchedSubscriberIds = friends
        .filter(f => f.status === 'connected' && subscriberUserIds.includes(f.friendUserId || ''))
        .map(f => f.id);
      setSelectedFriends(matchedFriendIds);
      setSubscriberFriends(matchedSubscriberIds);
      setNotes(editPlan.notes || '');
      setPlanStatus(editPlan.status || 'confirmed');
      setFeedVisibility(editPlan.feedVisibility || 'private');
    } else if (open && !editPlan) {
      // Reset for new plan
      setTitle('');
      setSelectedVibe('social');
      setActivity('drinks');
      setDate(defaultDate || new Date());
      setEndDate(undefined);
      setIsMultiDay(false);
      setTimeSlot('late-morning');
      setDuration('60');
      setStartTime('');
      setEndTime('');
      setLocationName('');
      setSelectedFriends([]);
      setSubscriberFriends([]);
      setFriendSearch('');
      setNotes('');
      setPlanStatus('confirmed');
      setFeedVisibility('private');
    }
  }, [open, editPlan, defaultDate]);

  // When vibe changes, select first activity in that vibe
  useEffect(() => {
    const activitiesInVibe = getActivitiesByVibe(selectedVibe);
    if (activitiesInVibe.length > 0 && !activitiesInVibe.includes(activity as ActivityType)) {
      setActivity(activitiesInVibe[0]);
    }
  }, [selectedVibe, activity]);

  // Determine if this is a shared plan edit with time/date changes
  const isSharedPlan = editPlan && editPlan.participants.length > 0;
  const isOwner = editPlan && (!editPlan.userId || editPlan.userId === userId);
  const isParticipantEditor = editPlan && !isOwner;
  const hasTimeChanges = editPlan && (
    format(date, 'yyyy-MM-dd') !== format(editPlan.date, 'yyyy-MM-dd') ||
    timeSlot !== editPlan.timeSlot ||
    parseInt(duration) !== editPlan.duration
  );
  // Both owners and participants need to propose time changes on shared plans
  const needsProposal = isSharedPlan && hasTimeChanges;

  // Check availability when time/date changes for shared plan edits
  useEffect(() => {
    if (!isSharedPlan || !hasTimeChanges) {
      setParticipantAvailability([]);
      return;
    }

    // Check availability for all other members (participants + owner if I'm not owner)
    const participantUserIds = editPlan.participants
      .map(p => p.friendUserId)
      .filter((id): id is string => !!id);
    
    // If participant is proposing, also check owner's availability
    if (!isOwner && editPlan.userId) {
      if (!participantUserIds.includes(editPlan.userId)) {
        participantUserIds.push(editPlan.userId);
      }
    }
    // Remove self
    const othersToCheck = participantUserIds.filter(id => id !== userId);

    if (othersToCheck.length === 0) return;

    setIsCheckingAvailability(true);
    checkParticipantAvailability(othersToCheck, date, timeSlot)
      .then(setParticipantAvailability)
      .finally(() => setIsCheckingAvailability(false));
  }, [date, timeSlot, isSharedPlan, hasTimeChanges]);

  const handleSubmit = async () => {
    // Handle recurring plan creation
    if (isRecurring && !editPlan) {
      try {
        await createRecurringPlan({
          title,
          activity,
          timeSlot,
          duration: parseInt(duration) || 60,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          location: locationName || undefined,
          notes: notes || undefined,
          frequency: recurrenceFrequency,
          dayOfWeek: date.getDay(),
          weekOfMonth: recurrenceFrequency === 'monthly' ? recurrenceWeekOfMonth : undefined,
          startsOn: format(date, 'yyyy-MM-dd'),
          feedVisibility,
        });
        toast.success(`Recurring plan created! 🔄 ${title} will repeat ${recurrenceFrequency === 'weekly' ? 'every week' : recurrenceFrequency === 'biweekly' ? 'every other week' : 'monthly'}.`);
        onOpenChange(false);
        resetForm();
        return;
      } catch (err) {
        toast.error('Failed to create recurring plan');
        return;
      }
    }

    if (needsProposal) {
      // Propose the change instead of direct update
      setIsProposing(true);
      
      // Build the list of people who need to respond (everyone except the proposer)
      const respondentUserIds: string[] = [];
      // Add participants
      for (const p of editPlan.participants) {
        if (p.friendUserId && p.friendUserId !== userId) {
          respondentUserIds.push(p.friendUserId);
        }
      }
      // If I'm a participant (not owner), the owner also needs to respond
      if (!isOwner && editPlan.userId && editPlan.userId !== userId) {
        if (!respondentUserIds.includes(editPlan.userId)) {
          respondentUserIds.push(editPlan.userId);
        }
      }

      const changes: { date?: Date; timeSlot?: TimeSlot; duration?: number } = {};
      if (format(date, 'yyyy-MM-dd') !== format(editPlan.date, 'yyyy-MM-dd')) {
        changes.date = date;
      }
      if (timeSlot !== editPlan.timeSlot) {
        changes.timeSlot = timeSlot;
      }
      if (parseInt(duration) !== editPlan.duration) {
        changes.duration = parseInt(duration);
      }

      // Apply non-time changes directly (both owner and participants can do this)
      const directUpdates: Partial<Plan> = {};
      if (title !== editPlan.title) directUpdates.title = title;
      if (activity !== editPlan.activity) directUpdates.activity = activity;
      if ((locationName || '') !== (editPlan.location?.name || '')) {
        directUpdates.location = locationName ? { id: crypto.randomUUID(), name: locationName, address: '' } : undefined;
      }
      if (notes !== (editPlan.notes || '')) directUpdates.notes = notes;
      if (feedVisibility !== (editPlan.feedVisibility || 'private')) directUpdates.feedVisibility = feedVisibility;

      if (Object.keys(directUpdates).length > 0) {
        await updatePlan(editPlan.id, directUpdates);
      }

      const success = await proposeChange(editPlan.id, changes, respondentUserIds);
      setIsProposing(false);

      if (success) {
        toast.success('Time change proposed! Waiting for approval.');
        onChangeProposed?.();
        onOpenChange(false);
        resetForm();
      } else {
        toast.error('Failed to propose change. Please try again.');
      }
      return;
    }

    // Participant editing non-time fields only (no proposal needed)
    if (editPlan && isParticipantEditor) {
      const directUpdates: Partial<Plan> = {};
      if (title !== editPlan.title) directUpdates.title = title;
      if (activity !== editPlan.activity) directUpdates.activity = activity;
      if ((locationName || '') !== (editPlan.location?.name || '')) {
        directUpdates.location = locationName ? { id: crypto.randomUUID(), name: locationName, address: '' } : undefined;
      }
      if (notes !== (editPlan.notes || '')) directUpdates.notes = notes;
      if (feedVisibility !== (editPlan.feedVisibility || 'private')) directUpdates.feedVisibility = feedVisibility;

      if (Object.keys(directUpdates).length > 0) {
        await updatePlan(editPlan.id, directUpdates);
      }
      onOpenChange(false);
      resetForm();
      return;
    }

    const allParticipants = [
      ...friends.filter((f) => selectedFriends.includes(f.id)).map(f => ({ ...f, role: 'participant' as const })),
      ...friends.filter((f) => subscriberFriends.includes(f.id)).map(f => ({ ...f, role: 'subscriber' as const })),
    ];

    const planData = {
      title,
      activity,
      date,
      endDate: isMultiDay && endDate ? endDate : undefined,
      timeSlot,
      duration: parseInt(duration) || 60,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      location: locationName ? { id: crypto.randomUUID(), name: locationName, address: '' } : undefined,
      participants: allParticipants,
      notes,
      status: planStatus,
      feedVisibility,
    };

    if (editPlan) {
      updatePlan(editPlan.id, planData);
    } else {
      addPlan({
        ...planData,
      });
    }

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setSelectedVibe('social');
    setActivity('drinks');
    setDate(new Date());
    setEndDate(undefined);
    setIsMultiDay(false);
    setTimeSlot('late-morning');
    setDuration('60');
    setStartTime('');
    setEndTime('');
    setLocationName('');
    setSelectedFriends([]);
    setSubscriberFriends([]);
    setFriendSearch('');
    setNotes('');
    setPlanStatus('confirmed');
    setFeedVisibility('private');
    setIsRecurring(false);
    setRecurrenceFrequency('weekly');
    setRecurrenceWeekOfMonth(1);
    setParticipantAvailability([]);
  };

  // Cycle: unselected -> participant -> subscriber -> unselected
  const toggleFriend = (friendId: string) => {
    const isParticipant = selectedFriends.includes(friendId);
    const isSubscriber = subscriberFriends.includes(friendId);
    
    if (!isParticipant && !isSubscriber) {
      // Add as participant
      setSelectedFriends(prev => [...prev, friendId]);
    } else if (isParticipant) {
      // Switch to subscriber
      setSelectedFriends(prev => prev.filter(id => id !== friendId));
      setSubscriberFriends(prev => [...prev, friendId]);
    } else {
      // Remove subscriber
      setSubscriberFriends(prev => prev.filter(id => id !== friendId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-lg">
            {editPlan ? 'Edit Plan' : 'New Plan'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title" className="text-xs">What are you planning?</Label>
            <Input
              id="title"
              placeholder="e.g., Dinner at that new place"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Activity Type with Vibes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Activity</Label>
            
            {/* Vibe Tabs */}
            <Tabs 
              value={selectedVibe} 
              onValueChange={(v) => setSelectedVibe(v as VibeType)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-4 h-8">
                {getAllVibes().map((vibe) => (
                  <TabsTrigger key={vibe} value={vibe} className="gap-1 text-xs py-1 px-1">
                    <span>{VIBE_CONFIG[vibe].icon}</span>
                    <span className="hidden sm:inline">{VIBE_CONFIG[vibe].label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Activity Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
              {vibeActivities.map((type) => {
                const config = ACTIVITY_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => setActivity(type)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 rounded-lg border p-1.5 transition-all",
                      activity === type
                        ? "border-primary bg-primary/10"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <ActivityIcon config={config} size={18} />
                    <span className="text-[8px] font-medium leading-tight text-center line-clamp-1">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Time Presets */}
          {!isMultiDay && !isParticipantEditor && (
          <div className="space-y-1">
            <Label className="text-xs">Quick Set</Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Morning ☕', slot: 'late-morning' as TimeSlot, start: '09:00', end: '10:30', dur: '90' },
                { label: 'Lunch 🍽️', slot: 'early-afternoon' as TimeSlot, start: '12:00', end: '13:00', dur: '60' },
                { label: 'Afternoon ☀️', slot: 'early-afternoon' as TimeSlot, start: '14:00', end: '16:00', dur: '120' },
                { label: 'Happy Hour 🍻', slot: 'late-afternoon' as TimeSlot, start: '17:00', end: '19:00', dur: '120' },
                { label: 'Dinner 🌮', slot: 'evening' as TimeSlot, start: '19:00', end: '21:00', dur: '120' },
                { label: 'Late Night 🌙', slot: 'late-night' as TimeSlot, start: '21:00', end: '23:00', dur: '120' },
              ].map((preset) => {
                const isActive = startTime === preset.start && endTime === preset.end && timeSlot === preset.slot;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setTimeSlot(preset.slot);
                      setStartTime(preset.start);
                      setEndTime(preset.end);
                      setDuration(preset.dur);
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Date, Time & Duration - hidden for participant editors */}
          {!isParticipantEditor && (
          <>
          <div className={cn("grid gap-2", isMultiDay ? "grid-cols-1" : "grid-cols-2")}>
            <div className="space-y-1">
              <Label className="text-xs">{isMultiDay ? 'Start Date' : 'Date'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 text-xs px-2",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {date ? format(date, 'MMM d') : 'Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      if (d) {
                        setDate(d);
                        if (endDate && d > endDate) setEndDate(undefined);
                      }
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {!isMultiDay && (
            <div className="space-y-1">
              <Label className="text-xs">Time Slot</Label>
              <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as TimeSlot)}>
                <SelectTrigger className="h-9 text-xs px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => (
                    <SelectItem key={slot} value={slot} className="text-xs">
                      {TIME_SLOT_LABELS[slot].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
          </div>

          {/* Multi-day toggle & end date */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isMultiDay}
                onChange={(e) => {
                  setIsMultiDay(e.target.checked);
                  if (!e.target.checked) setEndDate(undefined);
                  if (e.target.checked) setIsRecurring(false);
                }}
                className="rounded border-border"
              />
              <span className="text-xs text-muted-foreground">Multi-day plan</span>
            </label>

            {isMultiDay && (
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9 text-xs px-2",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {endDate ? format(endDate, 'MMM d') : 'Pick end date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => d && setEndDate(d)}
                      disabled={(d) => d < date}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Recurring toggle */}
          {!editPlan && !isMultiDay && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Repeat className="h-3 w-3" />
                Make recurring
              </span>
            </label>

            {isRecurring && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Frequency</Label>
                  <Select value={recurrenceFrequency} onValueChange={(v) => setRecurrenceFrequency(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly" className="text-xs">Every week</SelectItem>
                      <SelectItem value="biweekly" className="text-xs">Every other week</SelectItem>
                      <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recurrenceFrequency === 'monthly' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Which week?</Label>
                    <Select value={recurrenceWeekOfMonth.toString()} onValueChange={(v) => setRecurrenceWeekOfMonth(parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="text-xs">1st week</SelectItem>
                        <SelectItem value="2" className="text-xs">2nd week</SelectItem>
                        <SelectItem value="3" className="text-xs">3rd week</SelectItem>
                        <SelectItem value="4" className="text-xs">4th week</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  📅 Will repeat on {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()]}s
                  {recurrenceFrequency === 'monthly' && ` (${['', '1st', '2nd', '3rd', '4th'][recurrenceWeekOfMonth]} week)`}
                </p>
              </div>
            )}
          </div>
          )}

          {/* Start & End Time + Duration */}
          {!isMultiDay && (
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="h-9 text-xs px-2">
                  <SelectValue placeholder="Start" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {generateTimeOptions().map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="h-9 text-xs px-2">
                  <SelectValue placeholder="End" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {generateTimeOptions().map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-9 text-xs px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30" className="text-xs">30m</SelectItem>
                  <SelectItem value="60" className="text-xs">1h</SelectItem>
                  <SelectItem value="90" className="text-xs">1.5h</SelectItem>
                  <SelectItem value="120" className="text-xs">2h</SelectItem>
                  <SelectItem value="180" className="text-xs">3h</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          )}
          </>
          )}

          {/* Info banner for participant editors */}
          {isParticipantEditor && (
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground">
              ✏️ You can edit the title, activity, location, notes, and visibility. To change the date or time, use the change request flow.
            </div>
          )}

          {/* Status - owner only */}
          {!isParticipantEditor && (
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={planStatus} onValueChange={(v) => setPlanStatus(v as PlanStatus)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed" className="text-xs">✅ Confirmed</SelectItem>
                <SelectItem value="tentative" className="text-xs">🤔 Tentative</SelectItem>
              </SelectContent>
            </Select>
            {planStatus === 'tentative' && (
              <p className="text-[10px] text-muted-foreground">Tentative plans won't block your availability</p>
            )}
          </div>
          )}

          {/* Location */}
          <div className="space-y-1">
            <Label htmlFor="location" className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
            </Label>
            <div className="relative">
              <Input
                id="location"
                placeholder="Search for a place..."
                value={locationName}
                onChange={(e) => handleLocationChange(e.target.value)}
                onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="h-9 pr-8 text-sm"
              />
              {isSearchingLocation ? (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : (
                <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              )}
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-32 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                  {locationSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectLocation(suggestion)}
                      className="flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                    >
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-1">{suggestion.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Friends - compact (owner only) */}
          {!isParticipantEditor && (() => {
            const connectedFriends = friends.filter((f) => f.status === 'connected');
            if (connectedFriends.length === 0) return null;

            // Compute suggested friends: ranked by how often they co-appear in past plans
            const friendPlanCounts = new Map<string, number>();
            for (const plan of plans) {
              for (const p of plan.participants) {
                const matchedFriend = connectedFriends.find(f => f.friendUserId === p.friendUserId || f.id === p.id);
                if (matchedFriend) {
                  friendPlanCounts.set(matchedFriend.id, (friendPlanCounts.get(matchedFriend.id) || 0) + 1);
                }
              }
            }

            const suggestedFriends = [...connectedFriends]
              .sort((a, b) => (friendPlanCounts.get(b.id) || 0) - (friendPlanCounts.get(a.id) || 0))
              .slice(0, 5);

            const searchLower = friendSearch.toLowerCase();
            const filteredFriends = searchLower
              ? connectedFriends.filter(f => f.name.toLowerCase().includes(searchLower))
              : [];

            // Selected friends always visible at top
            const selectedConnected = connectedFriends.filter(f => selectedFriends.includes(f.id) || subscriberFriends.includes(f.id));

            return (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Friends
                </Label>

                {/* Selected friends chips */}
                {selectedConnected.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedConnected.map((friend) => {
                      const isParticipant = selectedFriends.includes(friend.id);
                      const isSubscriber = subscriberFriends.includes(friend.id);
                      return (
                        <button
                          key={friend.id}
                          onClick={() => toggleFriend(friend.id)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium transition-all flex items-center gap-1",
                            isParticipant && "bg-primary text-primary-foreground",
                            isSubscriber && "bg-accent text-accent-foreground border border-border",
                          )}
                        >
                          {isSubscriber && <Eye className="h-3 w-3" />}
                          {friend.name}
                          <span className="ml-0.5 opacity-60">×</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Input
                    placeholder="Search friends..."
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    className="h-8 text-xs pl-7"
                  />
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>

                {/* Search results */}
                {friendSearch && (
                  <div className="max-h-28 overflow-y-auto rounded-lg border border-border bg-popover">
                    {filteredFriends.length === 0 ? (
                      <p className="px-2.5 py-2 text-xs text-muted-foreground">No friends found</p>
                    ) : (
                      filteredFriends.map((friend) => {
                        const isParticipant = selectedFriends.includes(friend.id);
                        const isSubscriber = subscriberFriends.includes(friend.id);
                        const isSelected = isParticipant || isSubscriber;
                        return (
                          <button
                            key={friend.id}
                            onClick={() => { toggleFriend(friend.id); setFriendSearch(''); }}
                            className={cn(
                              "flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted transition-colors",
                              isSelected && "opacity-50"
                            )}
                          >
                            <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span>{friend.name}</span>
                            {isParticipant && <span className="ml-auto text-[10px] text-primary">Invited</span>}
                            {isSubscriber && <span className="ml-auto text-[10px] text-accent-foreground">Subscribed</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Suggested friends (when not searching) */}
                {!friendSearch && suggestedFriends.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground font-medium">Suggested</span>
                    <div className="flex flex-wrap gap-1">
                      {suggestedFriends
                        .filter(f => !selectedFriends.includes(f.id) && !subscriberFriends.includes(f.id))
                        .map((friend) => (
                          <button
                            key={friend.id}
                            onClick={() => toggleFriend(friend.id)}
                            className="rounded-full px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-all"
                          >
                            + {friend.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  Tap to invite · Tap again: subscribe (view only) · Again: remove
                </p>
              </div>
            );
          })()}

          {/* Availability Warning for shared plan edits */}
          {needsProposal && participantAvailability.length > 0 && (
            <AvailabilityWarning availability={participantAvailability} />
          )}
          {isCheckingAvailability && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking participant availability...
            </div>
          )}

          {/* Feed Visibility */}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <Eye className="h-3 w-3" />
              Share to Feed
            </Label>
            <Select value={feedVisibility} onValueChange={(v) => setFeedVisibility(v as FeedVisibility)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    Private — Only me & participants
                  </span>
                </SelectItem>
                <SelectItem value="friends">
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3" />
                    All Friends
                  </span>
                </SelectItem>
                {pods.map(pod => (
                  <SelectItem key={pod.id} value={`pod:${pod.id}`}>
                    <span className="flex items-center gap-1.5">
                      <span>{pod.emoji}</span>
                      {pod.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes - smaller */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Propose change info */}
          {needsProposal && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                Time/date changes will be proposed to participants for approval.
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              className="flex-1" 
              onClick={handleSubmit} 
              disabled={!title || isProposing}
            >
              {isProposing ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Proposing...</>
              ) : needsProposal ? (
                'Propose Change'
              ) : editPlan ? (
                'Save'
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
