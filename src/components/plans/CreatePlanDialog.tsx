import { useState, useEffect, useRef } from 'react';
import { usePlanProposals, ProposalOptionInput } from '@/hooks/usePlanProposals';
import { format, isToday, isTomorrow, addDays } from 'date-fns';
import { CalendarIcon, MapPin, Users, Search, Loader2, AlertTriangle, Eye, Globe, Lock, Repeat, ChevronDown, CircleCheck, CircleHelp, Lightbulb, ListPlus, X } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'; // kept for potential future use
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  getAllVibes,
  CustomActivity,
  getActivityConfig,
} from '@/types/planner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { usePlanChangeRequests } from '@/hooks/usePlanChangeRequests';
import { usePods } from '@/hooks/usePods';
import { useRecurringPlans } from '@/hooks/useRecurringPlans';
import { toast } from 'sonner';
import { PlanCreatedDialog } from '@/components/plans/PlanCreatedDialog';

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

const TIME_PRESETS = [
  { label: 'Morning ☕', slot: 'late-morning' as TimeSlot, start: '09:00', end: '10:30', dur: '90' },
  { label: 'Lunch 🍽️', slot: 'early-afternoon' as TimeSlot, start: '12:00', end: '13:00', dur: '60' },
  { label: 'Afternoon ☀️', slot: 'early-afternoon' as TimeSlot, start: '14:00', end: '16:00', dur: '120' },
  { label: 'Happy Hour 🍻', slot: 'late-afternoon' as TimeSlot, start: '17:00', end: '19:00', dur: '120' },
  { label: 'Dinner 🌮', slot: 'evening' as TimeSlot, start: '19:00', end: '21:00', dur: '120' },
  { label: 'Late Night 🌙', slot: 'late-night' as TimeSlot, start: '21:00', end: '23:00', dur: '120' },
];

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPlan?: Plan | null;
  defaultDate?: Date;
  defaultActivity?: ActivityType | string;
  defaultTimeSlot?: TimeSlot;
  defaultLocation?: string;
  defaultNotes?: string;
  defaultStatus?: PlanStatus;
  defaultFriendUserIds?: string[];
  defaultTitle?: string;
  onChangeProposed?: () => void;
}

export function CreatePlanDialog({ open, onOpenChange, editPlan, defaultDate, defaultActivity, defaultTimeSlot, defaultLocation, defaultNotes, defaultStatus, defaultFriendUserIds, defaultTitle, onChangeProposed }: CreatePlanDialogProps) {
  const { session } = useAuth();
  const { addPlan, updatePlan, friends, userId, plans } = usePlannerStore();
  const { proposeChange, checkParticipantAvailability } = usePlanChangeRequests();
  const { pods } = usePods();
  const { createRecurringPlan } = useRecurringPlans();
  const { createProposalOptions } = usePlanProposals();
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
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [createdPlanSummary, setCreatedPlanSummary] = useState<{
    title: string; activity: string; date: Date; endDate?: Date; timeSlot: TimeSlot;
    startTime?: string; endTime?: string; duration: number; location?: string;
    participants: typeof friends; status: string;
  } | null>(null);
  const [_showCustomTime, _setShowCustomTime] = useState(false); // kept for edit sync
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  // Multi-option proposal state
  const [isMultiOption, setIsMultiOption] = useState(false);
  const [proposalOptions, setProposalOptions] = useState<ProposalOptionInput[]>([]);
  
  // Shared plan change request state
  const [participantAvailability, setParticipantAvailability] = useState<{ userId: string; name: string; available: boolean }[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [customActivities, setCustomActivities] = useState<CustomActivity[]>([]);

  // Load custom activities from profile
  useEffect(() => {
    if (!session?.user) return;
    supabase.from('profiles').select('custom_activities').eq('user_id', session.user.id).single()
      .then(({ data }) => {
        if (data?.custom_activities) {
          setCustomActivities(data.custom_activities as unknown as CustomActivity[]);
        }
      });
  }, [session?.user]);

  // Auto-calculate duration when both start and end times are set
  useEffect(() => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const diffMin = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMin > 0) {
        const options = [30, 60, 90, 120, 180];
        const closest = options.reduce((prev, curr) =>
          Math.abs(curr - diffMin) < Math.abs(prev - diffMin) ? curr : prev
        );
        setDuration(closest.toString());
      }
    }
  }, [startTime, endTime]);

  const vibeActivities = getActivitiesByVibe(selectedVibe);

  // Location search
  const searchLocation = async (query: string) => {
    if (query.length < 2) { setLocationSuggestions([]); return; }
    setIsSearchingLocation(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { query, types: 'establishment' },
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
    } finally { setIsSearchingLocation(false); }
  };

  const handleLocationChange = (value: string) => {
    setLocationName(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchLocation(value), 300);
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
      const config = ACTIVITY_CONFIG[editPlan.activity as ActivityType];
      if (config) setSelectedVibe(config.vibeType);
      setDate(editPlan.date);
      setEndDate(editPlan.endDate || undefined);
      setIsMultiDay(!!editPlan.endDate);
      setTimeSlot(editPlan.timeSlot);
      setDuration(editPlan.duration?.toString() || '60');
      setStartTime(editPlan.startTime || '');
      setEndTime(editPlan.endTime || '');
      setLocationName(editPlan.location?.name || '');
      const participantUserIds = editPlan.participants.filter(p => p.role !== 'subscriber').map(p => p.friendUserId || p.id);
      const subscriberUserIds = editPlan.participants.filter(p => p.role === 'subscriber').map(p => p.friendUserId || p.id);
      const matchedFriendIds = friends.filter(f => f.status === 'connected' && participantUserIds.includes(f.friendUserId || '')).map(f => f.id);
      const matchedSubscriberIds = friends.filter(f => f.status === 'connected' && subscriberUserIds.includes(f.friendUserId || '')).map(f => f.id);
      setSelectedFriends(matchedFriendIds);
      setSubscriberFriends(matchedSubscriberIds);
      setNotes(editPlan.notes || '');
      setPlanStatus(editPlan.status || 'confirmed');
      setFeedVisibility(editPlan.feedVisibility || 'private');
      setShowMoreOptions(true); // Show all options when editing
      // showCustomTime no longer needed in new UI
    } else if (open && !editPlan) {
      resetForm();
      setDate(defaultDate || new Date());
      if (defaultActivity) {
        setActivity(defaultActivity);
        const config = ACTIVITY_CONFIG[defaultActivity as ActivityType];
        if (config) {
          setSelectedVibe(config.vibeType);
          if (!defaultTitle) setTitle(config.label);
        }
      }
      if (defaultTitle) setTitle(defaultTitle);
      if (defaultTimeSlot) setTimeSlot(defaultTimeSlot);
      if (defaultLocation) setLocationName(defaultLocation);
      if (defaultNotes) setNotes(defaultNotes);
      if (defaultStatus) setPlanStatus(defaultStatus);
      if (defaultFriendUserIds && defaultFriendUserIds.length > 0) {
        const matchedFriendIds = friends
          .filter(f => f.status === 'connected' && defaultFriendUserIds.includes(f.friendUserId || ''))
          .map(f => f.id);
        if (matchedFriendIds.length > 0) {
          setSelectedFriends(matchedFriendIds);
          if (!defaultStatus) setPlanStatus('proposed');
        }
      }
    }
  }, [open, editPlan, defaultDate]);

  // When vibe changes, select first activity in that vibe
  useEffect(() => {
    const activitiesInVibe = getActivitiesByVibe(selectedVibe);
    if (activitiesInVibe.length > 0 && !activitiesInVibe.includes(activity as ActivityType)) {
      setActivity(activitiesInVibe[0]);
    }
  }, [selectedVibe, activity]);

  // Shared plan edit logic
  const isSharedPlan = editPlan && editPlan.participants.length > 0;
  const isOwner = editPlan && (!editPlan.userId || editPlan.userId === userId);
  const isParticipantEditor = editPlan && !isOwner;
  const hasTimeChanges = editPlan && (
    format(date, 'yyyy-MM-dd') !== format(editPlan.date, 'yyyy-MM-dd') ||
    timeSlot !== editPlan.timeSlot ||
    parseInt(duration) !== editPlan.duration
  );
  const needsProposal = isSharedPlan && hasTimeChanges;

  useEffect(() => {
    if (!isSharedPlan || !hasTimeChanges) { setParticipantAvailability([]); return; }
    const participantUserIds = editPlan.participants.map(p => p.friendUserId).filter((id): id is string => !!id);
    if (!isOwner && editPlan.userId) {
      if (!participantUserIds.includes(editPlan.userId)) participantUserIds.push(editPlan.userId);
    }
    const othersToCheck = participantUserIds.filter(id => id !== userId);
    if (othersToCheck.length === 0) return;
    setIsCheckingAvailability(true);
    checkParticipantAvailability(othersToCheck, date, timeSlot)
      .then(setParticipantAvailability)
      .finally(() => setIsCheckingAvailability(false));
  }, [date, timeSlot, isSharedPlan, hasTimeChanges]);

  // Auto-generate title from activity
  const getAutoTitle = () => {
    if (activity === 'tbd') return 'TBD';
    const config = getActivityConfig(activity, customActivities);
    return config ? config.label : activity;
  };

  const effectiveTitle = title || getAutoTitle();

  const handleSubmit = async () => {
    // Handle multi-option proposal creation
    if (isMultiOption && proposalOptions.length >= 2 && !editPlan) {
      const allParticipants = [
        ...friends.filter((f) => selectedFriends.includes(f.id)).map(f => ({ ...f, role: 'participant' as const })),
        ...friends.filter((f) => subscriberFriends.includes(f.id)).map(f => ({ ...f, role: 'subscriber' as const })),
      ];

      // Create the plan with first option's date, status 'proposed', proposal_status 'voting'
      const firstOpt = proposalOptions[0];
      const planData = {
        title: effectiveTitle,
        activity,
        date: firstOpt.date,
        timeSlot: firstOpt.timeSlot,
        duration: parseInt(duration) || 60,
        startTime: firstOpt.startTime || undefined,
        endTime: endTime || undefined,
        location: locationName ? { id: crypto.randomUUID(), name: locationName, address: '' } : undefined,
        participants: allParticipants,
        notes,
        status: 'proposed' as PlanStatus,
        feedVisibility,
      };

      // Use addPlan which returns the created plan
      await addPlan(planData);
      
      // Get the newly created plan ID from the store
      const { plans: updatedPlans } = usePlannerStore.getState();
      const createdPlan = updatedPlans[updatedPlans.length - 1];
      
      if (createdPlan) {
        // Set proposal_status to 'voting'
        await supabase.from('plans').update({ proposal_status: 'voting' } as any).eq('id', createdPlan.id);
        
        // Create proposal options
        await createProposalOptions(createdPlan.id, proposalOptions);
      }

      setCreatedPlanSummary({
        title: effectiveTitle,
        activity,
        date: firstOpt.date,
        timeSlot: firstOpt.timeSlot,
        startTime: firstOpt.startTime,
        duration: parseInt(duration) || 60,
        location: locationName || undefined,
        participants: allParticipants,
        status: 'proposed',
      });

      onOpenChange(false);
      resetForm();
      return;
    }

    // Handle recurring plan creation
    if (isRecurring && !editPlan) {
      try {
        await createRecurringPlan({
          title: effectiveTitle,
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
        toast.success(`On the calendar 🔄 — ${effectiveTitle} will come back ${recurrenceFrequency === 'weekly' ? 'every week' : recurrenceFrequency === 'biweekly' ? 'every other week' : 'every month'}.`);
        onOpenChange(false);
        resetForm();
        return;
      } catch (err) {
        toast.error("Couldn't set up that recurring plan — try again?");
        return;
      }
    }

    if (needsProposal) {
      setIsProposing(true);
      const respondentUserIds: string[] = [];
      for (const p of editPlan.participants) {
        if (p.friendUserId && p.friendUserId !== userId) respondentUserIds.push(p.friendUserId);
      }
      if (!isOwner && editPlan.userId && editPlan.userId !== userId) {
        if (!respondentUserIds.includes(editPlan.userId)) respondentUserIds.push(editPlan.userId);
      }

      const changes: { date?: Date; timeSlot?: TimeSlot; duration?: number } = {};
      if (format(date, 'yyyy-MM-dd') !== format(editPlan.date, 'yyyy-MM-dd')) changes.date = date;
      if (timeSlot !== editPlan.timeSlot) changes.timeSlot = timeSlot;
      if (parseInt(duration) !== editPlan.duration) changes.duration = parseInt(duration);

      const directUpdates: Partial<Plan> = {};
      if (effectiveTitle !== editPlan.title) directUpdates.title = effectiveTitle;
      if (activity !== editPlan.activity) directUpdates.activity = activity;
      if ((locationName || '') !== (editPlan.location?.name || '')) {
        directUpdates.location = locationName ? { id: crypto.randomUUID(), name: locationName, address: '' } : undefined;
      }
      if (notes !== (editPlan.notes || '')) directUpdates.notes = notes;
      if (feedVisibility !== (editPlan.feedVisibility || 'private')) directUpdates.feedVisibility = feedVisibility;

      if (Object.keys(directUpdates).length > 0) await updatePlan(editPlan.id, directUpdates);

      const success = await proposeChange(editPlan.id, changes, respondentUserIds);
      setIsProposing(false);
      if (success) {
        toast.success('Suggested a new time — waiting on the crew.');
        onChangeProposed?.();
        onOpenChange(false);
        resetForm();
      } else {
        toast.error("Couldn't send that change — try again?");
      }
      return;
    }

    if (editPlan && isParticipantEditor) {
      const directUpdates: Partial<Plan> = {};
      if (effectiveTitle !== editPlan.title) directUpdates.title = effectiveTitle;
      if (activity !== editPlan.activity) directUpdates.activity = activity;
      if ((locationName || '') !== (editPlan.location?.name || '')) {
        directUpdates.location = locationName ? { id: crypto.randomUUID(), name: locationName, address: '' } : undefined;
      }
      if (notes !== (editPlan.notes || '')) directUpdates.notes = notes;
      if (feedVisibility !== (editPlan.feedVisibility || 'private')) directUpdates.feedVisibility = feedVisibility;
      if (Object.keys(directUpdates).length > 0) await updatePlan(editPlan.id, directUpdates);
      onOpenChange(false);
      resetForm();
      return;
    }

    const allParticipants = [
      ...friends.filter((f) => selectedFriends.includes(f.id)).map(f => ({ ...f, role: 'participant' as const })),
      ...friends.filter((f) => subscriberFriends.includes(f.id)).map(f => ({ ...f, role: 'subscriber' as const })),
    ];

    const planData = {
      title: effectiveTitle,
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
      addPlan(planData);
      // Show post-creation summary
      setCreatedPlanSummary({
        title: effectiveTitle,
        activity,
        date,
        endDate: isMultiDay && endDate ? endDate : undefined,
        timeSlot,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        duration: parseInt(duration) || 60,
        location: locationName || undefined,
        participants: allParticipants,
        status: planStatus,
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
    setShowMoreOptions(false);
    setIsMultiOption(false);
    setProposalOptions([]);
    // showCustomTime removed from new UI
  };

  const toggleFriend = (friendId: string) => {
    const isParticipant = selectedFriends.includes(friendId);
    const isSubscriber = subscriberFriends.includes(friendId);
    if (!isParticipant && !isSubscriber) {
      setSelectedFriends(prev => {
        const next = [...prev, friendId];
        // Auto-switch to proposed when first friend is added
        if (next.length === 1 && planStatus === 'confirmed') {
          setPlanStatus('proposed');
        }
        return next;
      });
    } else if (isParticipant) {
      setSelectedFriends(prev => {
        const next = prev.filter(id => id !== friendId);
        // Auto-switch back to confirmed when all friends removed
        if (next.length === 0 && subscriberFriends.length === 0 && planStatus === 'proposed') {
          setPlanStatus('confirmed');
        }
        return next;
      });
      setSubscriberFriends(prev => [...prev, friendId]);
    } else {
      setSubscriberFriends(prev => {
        const next = prev.filter(id => id !== friendId);
        if (selectedFriends.length === 0 && next.length === 0 && planStatus === 'proposed') {
          setPlanStatus('confirmed');
        }
        return next;
      });
    }
  };

  // Date quick-pick helpers
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  const formatDateChip = (d: Date) => {
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'EEE, MMM d');
  };

  const isDateSelected = (d: Date) => format(date, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');

  // Active time preset
  // activePreset no longer displayed separately

  // Count of extras configured
  const isEditMode = !!editPlan;
  const extrasCount = [
    notes,
    feedVisibility !== 'private',
    isRecurring,
    isMultiDay,
    // In edit mode, surface that secondary fields are configured
    isEditMode && title,
    isEditMode && activity && activity !== 'tbd',
    isEditMode && locationName,
    isEditMode && planStatus !== 'confirmed',
  ].filter(Boolean).length;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md p-4">
        <DialogHeader className="pb-1">
          <DialogTitle className="font-display text-lg">
            {editPlan ? 'Edit Plan' : 'New Plan'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* ── Title (hidden in edit mode — moved to More options) ── */}
          {!isEditMode && (
          <Input
            placeholder={`${getAutoTitle()} (or type a custom title)`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 text-sm"
          />
          )}
          {/* ── Activity Dropdown ── */}
          <div className="space-y-1">
            <Label className="text-xs">Activity</Label>
            <Select
              value={activity}
              onValueChange={(v) => {
                setActivity(v);
                const config = getActivityConfig(v, customActivities);
                if (config) setSelectedVibe(config.vibeType);
              }}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue>
                  {(() => {
                    if (activity === 'tbd') return (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <CircleHelp className="h-4 w-4" /> TBD
                      </span>
                    );
                    const config = getActivityConfig(activity, customActivities);
                    if (!config) return activity;
                    return (
                      <span className="flex items-center gap-2">
                        <ActivityIcon config={config} size={16} />
                        {config.label}
                      </span>
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {/* TBD option */}
                <SelectItem value="tbd" className="text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    ❓ TBD — decide later
                  </span>
                </SelectItem>

                {/* Custom activities */}
                {customActivities.length > 0 && (
                  <div>
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Your Activities
                    </div>
                    {customActivities.map((ca) => (
                      <SelectItem key={ca.id} value={ca.id} className="text-sm">
                        <span className="flex items-center gap-2">
                          {ca.icon} {ca.label}
                        </span>
                      </SelectItem>
                    ))}
                  </div>
                )}

                {getAllVibes().map((vibe) => {
                  const vibeConfig = VIBE_CONFIG[vibe];
                  const activities = getActivitiesByVibe(vibe);
                  return (
                    <div key={vibe}>
                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <vibeConfig.icon className="h-3.5 w-3.5" />
                        {vibeConfig.label}
                      </div>
                      {activities.map((type) => {
                        const config = ACTIVITY_CONFIG[type];
                        return (
                          <SelectItem key={type} value={type} className="text-sm">
                            <span className="flex items-center gap-2">
                              <ActivityIcon config={config} size={14} />
                              {config.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* ── Date (Calendar Popover) ── */}
          {!isParticipantEditor && (
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 text-sm")}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {isToday(date) ? 'Today' : isTomorrow(date) ? 'Tomorrow' : format(date, 'EEE, MMM d, yyyy')}
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
          )}

          {/* ── Time: Presets + Start/End pickers ── */}
          {!isMultiDay && !isParticipantEditor && (
          <div className="space-y-2">
            <Label className="text-xs">Time</Label>
            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5">
              {TIME_PRESETS.map((preset) => {
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
            {/* Start / End time selects */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Start</Label>
                <Select value={startTime} onValueChange={(v) => {
                  setStartTime(v);
                  // Auto-set time slot based on hour
                  const hour = parseInt(v.split(':')[0]);
                  if (hour < 9) setTimeSlot('early-morning');
                  else if (hour < 12) setTimeSlot('late-morning');
                  else if (hour < 15) setTimeSlot('early-afternoon');
                  else if (hour < 18) setTimeSlot('late-afternoon');
                  else if (hour < 22) setTimeSlot('evening');
                  else setTimeSlot('late-night');
                }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Start time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {generateTimeOptions().map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">End</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="End time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {generateTimeOptions().map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          )}

          {/* ── Multi-Option Proposal Toggle ── */}
          {!editPlan && !isParticipantEditor && !isMultiDay && selectedFriends.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMultiOption}
                  onChange={(e) => {
                    setIsMultiOption(e.target.checked);
                    if (e.target.checked) {
                      setProposalOptions([{ date, timeSlot, startTime: startTime || undefined }]);
                      setPlanStatus('proposed');
                    } else {
                      setProposalOptions([]);
                    }
                  }}
                  className="rounded border-border"
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ListPlus className="h-3 w-3" />
                  Propose multiple times
                </span>
              </label>

              {isMultiOption && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Time options ({proposalOptions.length}/5)
                  </p>
                  <div className="space-y-1.5">
                    {proposalOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
                        <span className="font-bold text-primary w-4 shrink-0">#{i + 1}</span>
                        <span className="font-medium">
                          {isToday(opt.date) ? 'Today' : isTomorrow(opt.date) ? 'Tomorrow' : format(opt.date, 'EEE, MMM d')}
                        </span>
                        <span className="text-muted-foreground">
                          {opt.startTime ? (() => {
                            const [h, m] = opt.startTime!.split(':').map(Number);
                            const ampm = h >= 12 ? 'pm' : 'am';
                            const hour12 = h % 12 || 12;
                            return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
                          })() : TIME_SLOT_LABELS[opt.timeSlot]?.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => setProposalOptions(prev => prev.filter((_, j) => j !== i))}
                          className="ml-auto text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {proposalOptions.length < 5 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs gap-1"
                      onClick={() => {
                        setProposalOptions(prev => [...prev, { date, timeSlot, startTime: startTime || undefined }]);
                      }}
                    >
                      <ListPlus className="h-3 w-3" />
                      Add current date/time as option
                    </Button>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Change the date & time above, then tap "Add" to include it. Friends will rank their preferences.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Status ── */}
          {!isParticipantEditor && (
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <div className="flex gap-2">
              {([
                { value: 'confirmed' as const, icon: CircleCheck, label: 'Confirmed', activeClass: 'border-primary bg-primary/10 text-primary' },
                { value: 'tentative' as const, icon: CircleHelp, label: 'Tentative', activeClass: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                { value: 'proposed' as const, icon: Lightbulb, label: 'Proposed', activeClass: 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' },
              ]).map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setPlanStatus(s.value)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                      planStatus === s.value
                        ? s.activeClass
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </button>
                );
              })}
            </div>
            {selectedFriends.length > 0 && planStatus === 'proposed' && (
              <p className="text-[10px] text-muted-foreground">Status will be confirmed when participants accept</p>
            )}
          </div>
          )}

          {/* Info banner for participant editors */}
          {isParticipantEditor && (
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground">
              ✏️ You can edit the title, activity, location, notes, and visibility. To change the date or time, use the change request flow.
            </div>
          )}

          {/* ── Location (Optional) ── */}
          <div className="space-y-1">
            <Label htmlFor="location" className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
              <span className="text-muted-foreground font-normal">(Optional)</span>
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

          {/* ── Friends (Optional) ── */}
          {!isParticipantEditor && (() => {
            const connectedFriends = friends.filter((f) => f.status === 'connected');
            if (connectedFriends.length === 0) return null;

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

            const selectedConnected = connectedFriends.filter(f => selectedFriends.includes(f.id) || subscriberFriends.includes(f.id));

            return (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Friends
                  <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>

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

                <div className="relative">
                  <Input
                    placeholder="Search friends..."
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    className="h-8 text-xs pl-7"
                  />
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>

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

          {/* ── More Options (Collapsible) ── */}
          <Collapsible open={showMoreOptions} onOpenChange={setShowMoreOptions}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
              <span className="flex items-center gap-1.5">
                More options
                {extrasCount > 0 && (
                  <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-semibold">{extrasCount}</span>
                )}
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showMoreOptions && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Feed Visibility */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <Eye className="h-3 w-3" />
                  Share to Feed
                </Label>
                <Select value={feedVisibility} onValueChange={(v) => setFeedVisibility(v as FeedVisibility)}>
                  <SelectTrigger className="h-8 text-xs">
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

              {/* Multi-day & Recurring */}
              {!isParticipantEditor && (
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
                        <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-8 text-xs px-2", !endDate && "text-muted-foreground")}>
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

                {!editPlan && !isMultiDay && (
                  <>
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
                  </>
                )}
              </div>
              )}

              {/* Notes */}
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

              {/* Time Slot (for multi-day hidden, but needed internally) */}
              {isMultiDay && (
                <input type="hidden" value={timeSlot} />
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Availability Warning */}
          {needsProposal && participantAvailability.length > 0 && (
            <AvailabilityWarning availability={participantAvailability} />
          )}
          {isCheckingAvailability && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking participant availability...
            </div>
          )}

          {needsProposal && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                Time/date changes will be proposed to participants for approval.
              </span>
            </div>
          )}

          {/* ── Create Button (always visible) ── */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              size="sm" 
              className="flex-1" 
              onClick={handleSubmit} 
              disabled={isProposing || (isMultiOption && proposalOptions.length < 2)}
            >
              {isProposing ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Proposing...</>
              ) : needsProposal ? (
                'Propose Change'
              ) : isMultiOption ? (
                `Propose ${proposalOptions.length} Options`
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

    <PlanCreatedDialog
      open={!!createdPlanSummary}
      onOpenChange={(open) => { if (!open) setCreatedPlanSummary(null); }}
      plan={createdPlanSummary}
    />
    </>
  );
}
export default CreatePlanDialog;
